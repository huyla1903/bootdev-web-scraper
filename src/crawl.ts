import { JSDOM } from "jsdom";
import pLimit from "p-limit";

export function normalizeURL(url: string): string {
  const urlObj = new URL(url);
  let fullPath = `${urlObj.host}${urlObj.pathname}`;
  if (fullPath.endsWith("/")) {
    fullPath = fullPath.slice(0, -1);
  }
  return fullPath.toLowerCase();
}

export function getHeadingFromHTML(html: string): string {
  const doc = new JSDOM(html).window.document;
  const heading = doc.querySelector("h1") ?? doc.querySelector("h2");
  return heading?.textContent?.trim() ?? "";
}

export function getFirstParagraphFromHTML(html: string): string {
  const doc = new JSDOM(html).window.document;
  const paragraph = doc.querySelector("main p") ?? doc.querySelector("p");
  return paragraph?.textContent?.trim() ?? "";
}

function resolveAttributeURLs(
  html: string,
  baseURL: string,
  selector: string,
  attribute: string,
): string[] {
  const doc = new JSDOM(html).window.document;
  const urls: string[] = [];
  for (const element of doc.querySelectorAll(selector)) {
    const value = element.getAttribute(attribute);
    if (value === null) {
      continue;
    }
    try {
      urls.push(new URL(value, baseURL).toString());
    } catch {
      // skip values that can't be resolved into a valid URL
    }
  }
  return urls;
}

export function getURLsFromHTML(html: string, baseURL: string): string[] {
  return resolveAttributeURLs(html, baseURL, "a", "href");
}

export function getImagesFromHTML(html: string, baseURL: string): string[] {
  return resolveAttributeURLs(html, baseURL, "img", "src");
}

export type ExtractedPageData = {
  url: string;
  heading: string;
  first_paragraph: string;
  outgoing_links: string[];
  image_urls: string[];
};

export function extractPageData(
  html: string,
  pageURL: string,
): ExtractedPageData {
  return {
    url: pageURL,
    heading: getHeadingFromHTML(html),
    first_paragraph: getFirstParagraphFromHTML(html),
    outgoing_links: getURLsFromHTML(html, pageURL),
    image_urls: getImagesFromHTML(html, pageURL),
  };
}

class ConcurrentCrawler {
  private baseURL: string;
  private pages: Record<string, ExtractedPageData>;
  private limit: ReturnType<typeof pLimit>;
  private maxPages: number;
  private shouldStop: boolean;
  private allTasks: Set<Promise<void>>;
  private visited: Set<string>;

  constructor(baseURL: string, maxConcurrency: number, maxPages: number) {
    this.baseURL = baseURL;
    this.pages = {};
    this.limit = pLimit(maxConcurrency);
    this.maxPages = maxPages;
    this.shouldStop = false;
    this.allTasks = new Set();
    this.visited = new Set();
  }

  private addPageVisit(normalizedURL: string): boolean {
    if (this.shouldStop) {
      return false;
    }
    if (this.visited.has(normalizedURL)) {
      return false;
    }
    if (this.visited.size >= this.maxPages) {
      this.shouldStop = true;
      console.log("Reached maximum number of pages to crawl.");
      return false;
    }
    this.visited.add(normalizedURL);
    return true;
  }

  // Returns "" when the page can't be fetched or isn't HTML.
  private async getHTML(currentURL: string): Promise<string> {
    return await this.limit(async () => {
      try {
        const response = await fetch(currentURL, {
          headers: { "User-Agent": "BootCrawler/1.0" },
        });

        if (response.status >= 400) {
          console.error(`error fetching ${currentURL}: HTTP ${response.status}`);
          return "";
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
          console.error(
            `error fetching ${currentURL}: non-HTML content type "${contentType}"`,
          );
          return "";
        }

        return await response.text();
      } catch (err) {
        console.error(`error fetching ${currentURL}: ${(err as Error).message}`);
        return "";
      }
    });
  }

  private async crawlPage(currentURL: string): Promise<void> {
    if (this.shouldStop) {
      return;
    }

    let currentHost: string;
    try {
      currentHost = new URL(currentURL).hostname;
    } catch {
      return;
    }
    if (currentHost !== new URL(this.baseURL).hostname) {
      return;
    }

    const normalizedURL = normalizeURL(currentURL);
    if (!this.addPageVisit(normalizedURL)) {
      return;
    }

    console.log(`crawling: ${currentURL}`);
    const html = await this.getHTML(currentURL);
    if (!html) {
      return;
    }

    const data = extractPageData(html, currentURL);
    this.pages[normalizedURL] = data;

    const crawls = data.outgoing_links.map((nextURL) => {
      const task = this.crawlPage(nextURL);
      this.allTasks.add(task);
      task.finally(() => this.allTasks.delete(task));
      return task;
    });
    await Promise.all(crawls);
  }

  async crawl(): Promise<Record<string, ExtractedPageData>> {
    await this.crawlPage(this.baseURL);
    return this.pages;
  }
}

export async function crawlSiteAsync(
  baseURL: string,
  maxConcurrency: number = 5,
  maxPages: number = 100,
): Promise<Record<string, ExtractedPageData>> {
  const crawler = new ConcurrentCrawler(baseURL, maxConcurrency, maxPages);
  return await crawler.crawl();
}
