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
    permissions: ["clipboard-read", "clipboard-write"],
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
  const visit = async (job, extra = "") => {
    const response = await page.goto(
      `${origin}/qa?job=${job}&actions=1&outreach=1&intake=1&delivery=1&refresh=1&packet=1${extra}`,
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
      "pursue",
      "resume",
      "application",
      "outreach",
      "interview",
      "offer",
    ]) {
      await visit(job);
      await page.locator(".job-header h1").waitFor();
      assert.equal(
        await page
          .getByText("This opportunity isn’t visible in this workspace", {
            exact: true,
          })
          .count(),
        0,
      );
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
  for (const extension of ["pdf", "docx", "png"]) {
    await visit("evaluate");
    await page.getByRole("button", { name: "Add Job", exact: true }).click();
    await page
      .getByLabel("How would you like to add it?")
      .selectOption("upload");
    const source = new URL(
      extension === "png"
        ? "../qa-evidence/canonical/page-1.png"
        : `../qa-evidence/canonical/resume-v1.${extension}`,
      import.meta.url,
    ).pathname;
    await page
      .getByLabel("Job document or screenshot", { exact: true })
      .setInputFiles(source);
    await page
      .getByRole("button", { name: "Add for review", exact: true })
      .click();
    await page.getByRole("heading", { name: "Job added for review" }).waitFor();
  }
  evidence.checks.push(
    "Actual file-picker selection and bounded validation of committed fictional canonical PDF/DOCX and PNG screenshot; synthetic callback only, no Storage upload",
  );
  await visit("resume", "&canonical=1");
  await page
    .getByRole("button", { name: "Load synthetic file fixtures" })
    .click();
  await page.locator(".material-row").first().click();
  await page.getByRole("button", { name: "Preview PDF", exact: true }).click();
  await page.getByText("Text from the exact PDF", { exact: true }).waitFor();
  assert.equal(await page.locator(".pdf-pages canvas").count(), 2);
  await page.getByText("Text from the exact PDF", { exact: true }).click();
  assert.match(await page.locator(".pdf-text").innerText(), /Casey Example/);
  for (const format of ["PDF", "DOCX"]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: `Download ${format}`, exact: true })
        .click(),
    ]);
    assert.equal(await download.failure(), null);
    const saved = `${temp}/canonical.${format.toLowerCase()}`;
    await download.saveAs(saved);
    const bytes = await readFile(saved),
      expected = await readFile(
        new URL(
          `../qa-evidence/canonical/resume-v1.${format.toLowerCase()}`,
          import.meta.url,
        ),
      );
    assert.equal(bytes.equals(expected), true);
    evidence.downloads.push({
      format: `canonical ${format}`,
      filename: download.suggestedFilename(),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      exactCommittedContentMatch: true,
    });
  }
  await page.screenshot({
    path: new URL("canonical-browser-preview.png", output).pathname,
    fullPage: true,
  });
  const canvasPng = await page
    .locator(".pdf-pages canvas")
    .first()
    .evaluate((canvas) => canvas.toDataURL("image/png"));
  await writeFile(
    new URL("canonical-browser-page-1.png", output),
    Buffer.from(canvasPng.split(",")[1], "base64"),
  );
  evidence.checks.push(
    "Committed canonical synthetic PDF renders two pages and extracts Casey Example; actual saved PDF/DOCX bytes match files and hashes exactly, no conversion executed",
  );
  for (const [width, height] of [
    [1536, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await visit("application");
    await page
      .getByRole("heading", { name: "Approved application packet" })
      .waitFor();
    const confirmation = page.getByRole("button", {
      name: "I submitted the application",
      exact: true,
    });
    assert.equal(await confirmation.isDisabled(), true);
    await page
      .getByRole("button", { name: "Load synthetic file fixtures" })
      .click();
    await confirmation.waitFor();
    assert.equal(await confirmation.isDisabled(), false);
    await page
      .getByRole("button", { name: "Copy Salary response", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      "Synthetic QA response: compensation depends on the role scope.",
    );
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.match(
      await page
        .getByRole("link", { name: "Open employer application", exact: true })
        .getAttribute("href"),
      /^https:\/\/example.invalid\/ats\//,
    );
    await page.screenshot({
      path: new URL(`approved-packet-${width}.png`, output).pathname,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page
      .getByText(
        "Research refresh in progress. Recorded facts remain available while it is checked.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Refresh", exact: true })
        .isDisabled(),
      true,
    );
    await page.screenshot({
      path: new URL(`research-pending-${width}.png`, output).pathname,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  evidence.checks.push(
    "Approved ATS packet desktop/mobile: exact pair readiness guards, explicit salary Copy, voluntary answers preserved, inspected ATS href; Copy never records submission. Research request shows plain pending state and prevents double-click",
  );
  await page.setViewportSize({ width: 1536, height: 1024 });
  await visit("evaluate", "&fail=1");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Synthetic uncertain research response" })
    .waitFor();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await page
    .getByText(
      "Research refresh in progress. Recorded facts remain available while it is checked.",
      { exact: true },
    )
    .waitFor();
  evidence.checks.push(
    "Research uncertain retry uses frozen request and reaches synthetic confirmation",
  );
  await visit("application", "&history=1&canonical=1");
  await page
    .getByRole("button", { name: "Load synthetic file fixtures" })
    .click();
  await page.locator(".snapshot summary").first().click();
  await page
    .getByRole("button", {
      name: "View exact submitted resume · version 1",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Version 1 · Submitted", { exact: true }).waitFor();
  assert.equal(
    await dialog.getByRole("link", { name: "Open recorded artifact" }).count(),
    0,
  );
  const [oldDownload] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download PDF", exact: true }).click(),
  ]);
  assert.equal(
    oldDownload.suggestedFilename(),
    "resume-v1-fixture-submitted-material.pdf",
  );
  const oldPath = `${temp}/historical.pdf`;
  await oldDownload.saveAs(oldPath);
  assert.equal(
    (await readFile(oldPath)).equals(
      await readFile(
        new URL("../qa-evidence/canonical/resume-v1.pdf", import.meta.url),
      ),
    ),
    true,
  );
  await page.screenshot({
    path: new URL("historical-exact-version.png", output).pathname,
    fullPage: true,
  });
  evidence.checks.push(
    "Submitted history resolves exact old v1 Material and canonical bytes after current v2 exists; legacy external URL is preserved as text without a clickable bypass",
  );
  await visit("interview");
  await page
    .getByRole("button", { name: "Start prep session", exact: true })
    .click();
  await page
    .getByText(
      "Prep session started. Work through your questions and evidence above.",
      { exact: true },
    )
    .waitFor();
  if (
    !(await page
      .getByLabel("New likely question (optional)", { exact: true })
      .isVisible())
  )
    await page.getByText("Prepare your conversation", { exact: true }).click();
  await page
    .getByLabel("New likely question (optional)", { exact: true })
    .fill(
      "Synthetic integrated prep question: how do you align operating teams?",
    );
  await page
    .getByRole("button", { name: "Save preparation", exact: true })
    .click();
  await page
    .getByText(
      "Synthetic integrated prep question: how do you align operating teams?",
      { exact: true },
    )
    .waitFor();
  evidence.checks.push(
    "Integrated Interview prep starts a session and saves a manual likely question without external meeting invitations",
  );
  await visit("offer");
  await page.getByRole("button", { name: "Negotiate", exact: true }).click();
  await page
    .getByLabel("Negotiation plan", { exact: true })
    .fill(
      "Synthetic negotiation plan only; human employer communication remains separate.",
    );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByText(
      "Synthetic negotiation plan only; human employer communication remains separate.",
      { exact: false },
    )
    .waitFor();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  const decision = page.getByRole("dialog");
  await decision
    .getByLabel("Decision reason", { exact: true })
    .fill("Synthetic acceptance for browser QA; no real offer commitment.");
  await decision.getByRole("checkbox").check();
  await decision
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await page
    .getByText(
      "Synthetic acceptance for browser QA; no real offer commitment.",
      { exact: false },
    )
    .waitFor();
  evidence.checks.push(
    "Integrated Offer records a synthetic negotiation plan and explicit exact-terms human decision; no employer contact or real commitment",
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
