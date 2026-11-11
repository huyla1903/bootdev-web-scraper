import fs from "node:fs";
import path from "node:path";
import type { ExtractedPageData } from "./crawl";

export function writeJSONReport(
  pageData: Record<string, ExtractedPageData>,
  filename = "report.json",
): void {
  const sorted = Object.values(pageData).sort((a, b) =>
    a.url.localeCompare(b.url),
  );
  const filePath = path.resolve(process.cwd(), filename);
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2));
  console.log(`Report written to ${filePath}`);
}
