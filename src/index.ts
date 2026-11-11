import { crawlSiteAsync } from "./crawl";
import { writeJSONReport } from "./report";

const USAGE = "usage: npm run start <URL> <maxConcurrency> <maxPages>";

function parsePositiveInt(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`${name} must be a positive integer, got "${value}"`);
    console.error(USAGE);
    process.exit(1);
  }
  return n;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("no website provided");
    console.error(USAGE);
    process.exit(1);
  }
  if (args.length > 3) {
    console.error("too many arguments provided");
    console.error(USAGE);
    process.exit(1);
  }

  const baseURL = args[0];
  const maxConcurrency =
    args[1] !== undefined ? parsePositiveInt(args[1], "maxConcurrency") : 5;
  const maxPages =
    args[2] !== undefined ? parsePositiveInt(args[2], "maxPages") : 100;

  console.log(
    `starting crawl of: ${baseURL} (maxConcurrency=${maxConcurrency}, maxPages=${maxPages})`,
  );

  const pages = await crawlSiteAsync(baseURL, maxConcurrency, maxPages);

  console.log("Finished crawling.");
  const firstPage = Object.values(pages)[0];
  if (firstPage) {
    console.log(
      `First page record: ${firstPage["url"]} - ${firstPage["heading"]}`,
    );
  }

  writeJSONReport(pages, "report.json");
  process.exit(0);
}

main();
