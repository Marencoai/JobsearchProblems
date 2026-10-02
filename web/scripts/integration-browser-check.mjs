import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const origin = "http://127.0.0.1:3117";
const output = new URL("../qa-evidence/integration/", import.meta.url);
await mkdir(output, { recursive: true });
const temp = await mkdtemp("/tmp/hq-integration-browser-");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.argv[2],
});
const evidence = {
  browser: browser.version(),
  checks: [],
  downloads: [],
  pageErrors: [],
  externalRequests: 0,
};
try {
  const context = await browser.newContext({
    acceptDownloads: true,
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      evidence.externalRequests++;
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  const visit = async (job) => {
    const response = await page.goto(
      `${origin}/qa?job=${job}&actions=1&outreach=1&intake=1&delivery=1`,
    );
    assert.equal(response.status(), 200);
    await page.locator(".workspace-content").waitFor();
  };
  for (const [width, height] of [
    [1536, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const job of [
      "evaluate",
      "resume",
      "apply",
      "submitted",
      "outreach",
      "interview",
      "offer",
    ]) {
      await visit(job);
      assert.ok(await page.locator("main").innerText());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: new URL(`${job}-${width}.png`, output).pathname,
        fullPage: true,
      });
    }
  }
  evidence.checks.push(
    "Seven role stages at desktop and mobile; no document horizontal overflow",
  );
  await page.setViewportSize({ width: 1536, height: 1024 });
  await visit("resume");
  await page
    .getByRole("button", { name: "Load synthetic file fixtures" })
    .click();
  await page.locator(".material-row").first().click();
  await page.getByRole("button", { name: "Preview PDF", exact: true }).click();
  await page.getByText("Text from the exact PDF", { exact: true }).waitFor();
  assert.equal(await page.locator(".pdf-pages canvas").count(), 2);
  await page.getByText("Text from the exact PDF", { exact: true }).click();
  assert.match(
    await page.locator(".pdf-text").innerText(),
    /Synthetic exact Material version one/,
  );
  const canvasImage = await page
    .locator(".pdf-pages canvas")
    .first()
    .evaluate((canvas) => {
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] < 100 &&
          pixels[i + 1] < 100 &&
          pixels[i + 2] < 100 &&
          pixels[i + 3] > 0
        )
          dark++;
      return { dark, png: canvas.toDataURL("image/png") };
    });
  assert.ok(
    canvasImage.dark > 100,
    "PDF page must contain rendered dark text pixels",
  );
  await writeFile(
    new URL("synthetic-pdf-canvas.png", output),
    Buffer.from(canvasImage.png.split(",")[1], "base64"),
  );
  await page.screenshot({
    path: new URL("synthetic-pdf-preview.png", output).pathname,
    fullPage: true,
  });
  for (const format of ["PDF", "DOCX"]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: `Download ${format}`, exact: true })
        .click(),
    ]);
    assert.equal(await download.failure(), null);
    const path = `${temp}/${format.toLowerCase()}`;
    await download.saveAs(path);
    const bytes = await readFile(path);
    assert.ok(bytes.length > 0);
    if (format === "PDF")
      assert.equal(bytes.subarray(0, 8).toString(), "%PDF-1.4");
    else assert.equal(bytes.subarray(0, 2).toString(), "PK");
    evidence.downloads.push({
      format,
      filename: download.suggestedFilename(),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  evidence.checks.push(
    "Synthetic two-page PDF rendered by installed PDF.js; text extraction and real PDF/DOCX browser downloads pass (transport fixtures, not canonical renderer acceptance)",
  );
  for (const mode of ["url", "text", "upload"]) {
    await visit("evaluate");
    await page.getByRole("button", { name: "Add Job", exact: true }).click();
    await page.getByLabel("How would you like to add it?").selectOption(mode);
    if (mode === "url")
      await page
        .getByLabel("Job URL", { exact: true })
        .fill("https://example.invalid/careers/synthetic-role");
    else if (mode === "text")
      await page
        .getByLabel("Full job description")
        .fill(
          "Synthetic role evidence for a revenue operations leader. This is a local browser test fixture only.",
        );
    else
      await page
        .getByLabel("Job document or screenshot", { exact: true })
        .setInputFiles({
          name: "synthetic-job.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            "Synthetic job evidence for local upload verification. No real candidate or employer data.",
          ),
        });
    await page
      .getByRole("button", { name: "Add for review", exact: true })
      .click();
    await page.getByRole("heading", { name: "Job added for review" }).waitFor();
  }
  evidence.checks.push(
    "Manual URL, pasted description, and real file-picker synthetic text upload reach explicit confirmation",
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.equal(evidence.externalRequests, 0);
  await writeFile(
    new URL("browser-results.json", output),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
