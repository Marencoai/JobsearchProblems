// Usage: node scripts/interview-download-check.mjs /absolute/playwright/index.mjs /absolute/chrome
// Start owned development-only synthetic QA on loopback3023 first.
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
import { readFile, mkdtemp, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = await mkdtemp("/tmp/hq-download-");
const browser = await chromium.launch({
  executablePath: process.argv[3],
  headless: true,
});
try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:3023"
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3023/qa?job=interview");
  const link = page.getByRole("link", { name: "Download concise cheat sheet" });
  await link.waitFor();
  const href = await link.getAttribute("href");
  const expected = decodeURIComponent(href.split(",")[1]);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  assert.equal(
    download.suggestedFilename(),
    "interview-synthetic-interview-cheat-sheet.txt",
  );
  assert.equal(await download.failure(), null);
  const path = root + "/actual-interview-cheat-sheet.txt";
  await download.saveAs(path);
  const bytes = await readFile(path);
  assert.equal(bytes.toString("utf8"), expected);
  assert.ok(bytes.length > 0 && bytes.length < 20000);
  const evidence = new URL("../qa-evidence/interview/", import.meta.url)
    .pathname;
  await page.screenshot({
    path: evidence + "/verified-download-desktop.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        browser: await browser.version(),
        filename: download.suggestedFilename(),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        downloadFailure: null,
        exactContentMatch: true,
        transport: "data:text/plain;charset=utf-8; no HTTP response headers",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await rm(root, { recursive: true, force: true });
}
