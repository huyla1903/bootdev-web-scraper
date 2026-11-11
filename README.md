# bootdev-web-scraper

A concurrent web crawler written in TypeScript, built for the Boot.dev course "Build a Web Scraper in TypeScript".

Starting from a base URL, it crawls every page on the same domain and saves each page's heading, first paragraph, outgoing links and image URLs to `report.json`.

## Requirements

- [nvm](https://github.com/nvm-sh/nvm) (the project uses the Node.js version in `.nvmrc`, currently 22.15.0)

## Getting started

```bash
git clone https://github.com/huyla1903/bootdev-web-scraper.git
cd bootdev-web-scraper
nvm use
npm install
```

## Usage

```bash
npm run start <URL> [maxConcurrency] [maxPages]
```

| Argument | Default | Meaning |
|---|---|---|
| `URL` | required | Page to start from. Only pages on the same hostname are crawled. |
| `maxConcurrency` | `5` | Maximum number of requests in flight at once. |
| `maxPages` | `100` | Stop after this many unique pages. |

Example:

```bash
npm run start https://learnwebscraping.dev/practice/ecommerce/ 3 10
```

The crawler prints each URL as it crawls it, then writes `report.json` to the current directory. The report is an array of page records sorted by URL:

```json
[
  {
    "url": "https://learnwebscraping.dev/practice/ecommerce/",
    "heading": "Fantasy Ecommerce Catalog",
    "first_paragraph": "Browse fantasy product listings, ...",
    "outgoing_links": ["https://learnwebscraping.dev/practice/ecommerce/categories/"],
    "image_urls": []
  }
]
```

## Tests

```bash
npm test
```

Unit tests use [Vitest](https://vitest.dev/) and live in `src/crawl.test.ts`.

## Project layout

- `src/index.ts`: command-line entry point
- `src/crawl.ts`: URL normalization, HTML extraction and the `ConcurrentCrawler` class
- `src/report.ts`: writes the JSON report
