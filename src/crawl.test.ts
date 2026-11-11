import { describe, expect, test } from "vitest";
import {
  normalizeURL,
  getHeadingFromHTML,
  getFirstParagraphFromHTML,
  getURLsFromHTML,
  getImagesFromHTML,
  extractPageData,
} from "./crawl";

describe("normalizeURL", () => {
  const expected = "www.boot.dev/blog/path";

  test("strips https protocol and trailing slash", () => {
    expect(normalizeURL("https://www.boot.dev/blog/path/")).toBe(expected);
  });

  test("strips https protocol", () => {
    expect(normalizeURL("https://www.boot.dev/blog/path")).toBe(expected);
  });

  test("strips http protocol and trailing slash", () => {
    expect(normalizeURL("http://www.boot.dev/blog/path/")).toBe(expected);
  });

  test("strips http protocol", () => {
    expect(normalizeURL("http://www.boot.dev/blog/path")).toBe(expected);
  });

  test("lowercases the host", () => {
    expect(normalizeURL("https://WWW.Boot.DEV/blog/path")).toBe(expected);
  });

  test("ignores query string and fragment", () => {
    expect(normalizeURL("https://www.boot.dev/blog/path?x=1#top")).toBe(expected);
  });

  test("keeps non-default port", () => {
    expect(normalizeURL("http://localhost:8080/path/")).toBe("localhost:8080/path");
  });

  test("root URL normalizes to host only", () => {
    expect(normalizeURL("https://www.boot.dev/")).toBe("www.boot.dev");
  });

  test("throws on invalid URL", () => {
    expect(() => normalizeURL("not a url")).toThrow();
  });
});

describe("getHeadingFromHTML", () => {
  test("getHeadingFromHTML basic", () => {
    const inputBody = `<html><body><h1>Test Title</h1></body></html>`;
    expect(getHeadingFromHTML(inputBody)).toEqual("Test Title");
  });

  test("falls back to h2 when there is no h1", () => {
    const inputBody = `<html><body><h2>Subtitle</h2></body></html>`;
    expect(getHeadingFromHTML(inputBody)).toEqual("Subtitle");
  });

  test("prefers h1 over an earlier h2", () => {
    const inputBody = `<html><body><h2>Sub</h2><h1>Main</h1></body></html>`;
    expect(getHeadingFromHTML(inputBody)).toEqual("Main");
  });

  test("returns empty string when there is no heading", () => {
    const inputBody = `<html><body><p>No heading</p></body></html>`;
    expect(getHeadingFromHTML(inputBody)).toEqual("");
  });
});

describe("getFirstParagraphFromHTML", () => {
  test("getFirstParagraphFromHTML main priority", () => {
    const inputBody = `
      <html><body>
        <p>Outside paragraph.</p>
        <main>
          <p>Main paragraph.</p>
        </main>
      </body></html>
    `;
    expect(getFirstParagraphFromHTML(inputBody)).toEqual("Main paragraph.");
  });

  test("returns the first paragraph inside main", () => {
    const inputBody = `
      <html><body>
        <h1>Welcome to Boot.dev</h1>
        <main>
          <p>Learn to code by building real projects.</p>
          <p>This is the second paragraph.</p>
        </main>
      </body></html>
    `;
    expect(getFirstParagraphFromHTML(inputBody)).toEqual(
      "Learn to code by building real projects.",
    );
  });

  test("falls back to first paragraph when there is no main", () => {
    const inputBody = `<html><body><p>First.</p><p>Second.</p></body></html>`;
    expect(getFirstParagraphFromHTML(inputBody)).toEqual("First.");
  });

  test("falls back when main has no paragraph", () => {
    const inputBody = `<html><body><main><div>x</div></main><p>Outside.</p></body></html>`;
    expect(getFirstParagraphFromHTML(inputBody)).toEqual("Outside.");
  });

  test("returns empty string when there is no paragraph", () => {
    const inputBody = `<html><body><h1>Title</h1></body></html>`;
    expect(getFirstParagraphFromHTML(inputBody)).toEqual("");
  });
});

describe("getURLsFromHTML", () => {
  const inputURL = "https://crawler-test.com";

  test("getURLsFromHTML absolute", () => {
    const inputBody = `<html><body><a href="/path/one"><span>Boot.dev</span></a></body></html>`;
    expect(getURLsFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/path/one",
    ]);
  });

  test("keeps absolute URLs unchanged", () => {
    const inputBody = `<html><body><a href="https://other.com/page">x</a></body></html>`;
    expect(getURLsFromHTML(inputBody, inputURL)).toEqual([
      "https://other.com/page",
    ]);
  });

  test("finds all anchors in order", () => {
    const inputBody = `
      <html><body>
        <a href="/one">1</a>
        <div><a href="https://crawler-test.com/two">2</a></div>
        <a href="three">3</a>
      </body></html>
    `;
    expect(getURLsFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/one",
      "https://crawler-test.com/two",
      "https://crawler-test.com/three",
    ]);
  });

  test("skips anchors without href", () => {
    const inputBody = `<html><body><a>no link</a><a href="/ok">ok</a></body></html>`;
    expect(getURLsFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/ok",
    ]);
  });

  test("returns empty array when there are no anchors", () => {
    const inputBody = `<html><body><p>nothing</p></body></html>`;
    expect(getURLsFromHTML(inputBody, inputURL)).toEqual([]);
  });
});

describe("getImagesFromHTML", () => {
  const inputURL = "https://crawler-test.com";

  test("getImagesFromHTML relative", () => {
    const inputBody = `<html><body><img src="/logo.png" alt="Logo"></body></html>`;
    expect(getImagesFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/logo.png",
    ]);
  });

  test("keeps absolute image URLs unchanged", () => {
    const inputBody = `<html><body><img src="https://cdn.example.com/a.jpg"></body></html>`;
    expect(getImagesFromHTML(inputBody, inputURL)).toEqual([
      "https://cdn.example.com/a.jpg",
    ]);
  });

  test("finds multiple images", () => {
    const inputBody = `<html><body><img src="/a.png"><p><img src="/b.png"></p></body></html>`;
    expect(getImagesFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/a.png",
      "https://crawler-test.com/b.png",
    ]);
  });

  test("skips images with missing src", () => {
    const inputBody = `<html><body><img alt="no src"><img src="/ok.png"></body></html>`;
    expect(getImagesFromHTML(inputBody, inputURL)).toEqual([
      "https://crawler-test.com/ok.png",
    ]);
  });

  test("returns empty array when there are no images", () => {
    const inputBody = `<html><body><p>nothing</p></body></html>`;
    expect(getImagesFromHTML(inputBody, inputURL)).toEqual([]);
  });
});

describe("extractPageData", () => {
  test("extractPageData basic", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `
      <html><body>
        <h1>Test Title</h1>
        <p>This is the first paragraph.</p>
        <a href="/link1">Link 1</a>
        <img src="/image1.jpg" alt="Image 1">
      </body></html>
    `;
    expect(extractPageData(inputBody, inputURL)).toEqual({
      url: "https://crawler-test.com",
      heading: "Test Title",
      first_paragraph: "This is the first paragraph.",
      outgoing_links: ["https://crawler-test.com/link1"],
      image_urls: ["https://crawler-test.com/image1.jpg"],
    });
  });

  test("resolves relative URLs against a nested page URL", () => {
    const inputURL = "https://crawler-test.com/blog/post";
    const inputBody = `
      <html><body>
        <h2>Fallback Heading</h2>
        <p>Outside.</p>
        <main><p>Inside main.</p></main>
        <a href="other">rel</a>
        <a href="https://elsewhere.com/x">abs</a>
        <img src="img.png">
      </body></html>
    `;
    expect(extractPageData(inputBody, inputURL)).toEqual({
      url: "https://crawler-test.com/blog/post",
      heading: "Fallback Heading",
      first_paragraph: "Inside main.",
      outgoing_links: [
        "https://crawler-test.com/blog/other",
        "https://elsewhere.com/x",
      ],
      image_urls: ["https://crawler-test.com/blog/img.png"],
    });
  });

  test("returns empty values for a page with no content", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body></body></html>`;
    expect(extractPageData(inputBody, inputURL)).toEqual({
      url: "https://crawler-test.com",
      heading: "",
      first_paragraph: "",
      outgoing_links: [],
      image_urls: [],
    });
  });
});
