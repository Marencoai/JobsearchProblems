import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const origin = "http://127.0.0.1:3104";
const output = fileURLToPath(
  new URL("../qa-evidence/outreach/", import.meta.url),
);
await mkdir(output, { recursive: true });
// Always a new owned headless browser/profile; never attach to a user browser.
const browser = await chromium.launch({
  headless: true,
  ...(process.argv[2] ? { executablePath: process.argv[2] } : {}),
});
const evidence = {
  browser: browser.version(),
  viewports: [],
  checks: [],
  externalRequests: 0,
  pageErrors: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
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
    if (url.pathname === "/api/public-config") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Synthetic preview has no live configuration"}',
      });
      return;
    }
    if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/"))
      throw new Error("Synthetic preview attempted live data access");
    await route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => evidence.pageErrors.push(e.message));
  const fresh = async () => {
    const response = await page.goto(origin + "/qa?outreach=1");
    assert.equal(response.status(), 200);
    await page.getByRole("region", { name: "Outreach workspace" }).waitFor();
    await page.getByLabel("Message", { exact: true }).waitFor();
  };
  await fresh();
  for (const [width, height] of [
    [1536, 1024],
    [1280, 900],
    [768, 1024],
    [390, 844],
    [320, 720],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page
        .getByRole("navigation", { name: "Opportunity stages" })
        .locator("button")
        .count(),
      7,
    );
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      dialogCount: document.querySelectorAll("dialog[open]").length,
    }));
    assert.ok(
      metrics.width <= width + 1,
      `Horizontal overflow at ${width}: ${metrics.width}`,
    );
    evidence.viewports.push({ width, height, ...metrics });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: output + `outreach-${width}.png` });
    if (width <= 768) {
      await page
        .getByLabel("Message", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + `outreach-message-${width}.png` });
    }
  }
  evidence.checks.push(
    "Five responsive widths have seven stages and no document horizontal overflow",
  );
  await page.setViewportSize({ width: 1536, height: 1024 });
  const message = await page
    .getByLabel("Message", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Copy message", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    message,
  );
  assert.equal(
    await page.getByText("Version 2 · Review", { exact: true }).count(),
    1,
  );
  evidence.checks.push(
    "Copy preserves review status; exact synthetic text matches clipboard",
  );
  await page
    .getByRole("button", { name: "I sent this message", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Record an already-sent message",
  });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("checkbox").isChecked(), false);
  await dialog
    .getByRole("button", { name: "Record sent message", exact: true })
    .click();
  assert.equal(await dialog.count(), 1);
  for (const [width, height] of [
    [1536, 1024],
    [390, 844],
    [320, 720],
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await dialog.evaluate((d) => ({
      width: d.clientWidth,
      scroll: d.scrollWidth,
      confirmation: d
        .querySelector(".confirmation-check span")
        .getBoundingClientRect().width,
      focused: d.contains(document.activeElement),
    }));
    assert.ok(bounds.scroll <= bounds.width + 1, `Dialog overflow at ${width}`);
    assert.ok(bounds.confirmation > 150, `Unreadable attestation at ${width}`);
    assert.ok(bounds.focused, "Native dialog retains keyboard focus");
    await page.screenshot({
      path: output + `outreach-sent-confirmation-${width}.png`,
    });
    if (width < 768) {
      await dialog
        .getByRole("button", { name: "Record sent message", exact: true })
        .scrollIntoViewIfNeeded();
      const controls = await dialog
        .getByRole("button", { name: "Record sent message", exact: true })
        .boundingBox();
      assert.ok(
        controls && controls.y >= 0 && controls.y + controls.height <= height,
        "Confirmation controls reachable within viewport",
      );
      await page.screenshot({
        path: output + `outreach-sent-controls-${width}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "I sent this message", exact: true })
      .evaluate((b) => b === document.activeElement),
    true,
  );
  assert.equal(
    await page.getByText("Version 2 · Review", { exact: true }).count(),
    1,
  );
  evidence.checks.push(
    "Opening, unconfirmed submission and Escape preserve unsent version",
  );
  await page
    .getByLabel("Message", { exact: true })
    .fill("Entire synthetic replacement\nExact new body.");
  assert.equal(
    await page
      .getByRole("button", { name: "I sent this message", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page.getByText("Version 3 · Review", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Message", { exact: true }).inputValue(),
    "Entire synthetic replacement\nExact new body.",
  );
  assert.equal(
    await page.getByText("Preserved message version", { exact: true }).count(),
    3,
  );
  evidence.checks.push(
    "Whole replacement creates v3 and preserves historical bodies",
  );
  await page
    .getByRole("button", { name: "Request revision", exact: true })
    .click();
  await page.getByLabel("Guidance (optional)").fill("Synthetic guidance only");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Request preparation", exact: true })
    .click();
  await page
    .getByText(
      "Draft preparation requested. Your worker will return a new version for review.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.getByLabel("Message", { exact: true }).inputValue(),
    "Entire synthetic replacement\nExact new body.",
  );
  evidence.checks.push(
    "Revision requests stay queued; fixture does not generate or send",
  );
  await page
    .getByRole("button", { name: "I sent this message", exact: true })
    .click();
  await dialog.getByLabel("Follow-up choice").selectOption("none");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Record sent message", exact: true })
    .click();
  await page
    .getByText(
      "Your exact sent message is recorded. Follow-up reflects your choice.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page
      .getByText("Exact recorded sent version", { exact: true })
      .count(),
    1,
  );
  await page.screenshot({
    path: output + "outreach-sent-history.png",
    fullPage: true,
  });
  evidence.checks.push(
    "Explicit synthetic attestation records one frozen sent version with no follow-up",
  );
  await page.getByRole("button", { name: "Add a person", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Synthetic");
  await page
    .getByLabel("Email (optional)", { exact: true })
    .fill("taylor@example.invalid");
  await page
    .getByLabel("Why this person? (optional)", { exact: true })
    .fill("Manual professional contact outside recommendations");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Taylor Synthetic", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Message", { exact: true }).inputValue(),
    "",
  );
  evidence.checks.push(
    "Manual contact is immediately available with an independent linked workstream",
  );
  await page
    .getByLabel("Relationship context", { exact: true })
    .selectOption("general");
  await page.getByRole("button", { name: /Morgan Blake/ }).waitFor();
  await page.getByRole("button", { name: /Morgan Blake/ }).click();
  await page
    .getByRole("button", { name: "Start a message", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("General professional networking message");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page
    .locator("details.outreach-history-item")
    .filter({ hasText: "Morgan Blake · General relationship" })
    .locator("summary")
    .click();
  await page.getByText(/Morgan Blake · General relationship/).waitFor();
  evidence.checks.push(
    "General reusable relationship creates a draft without Opportunity context",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const nav = page.getByRole("dialog", { name: "Job pipeline", exact: true });
  await nav.waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(".sidebar").getAttribute("aria-hidden"),
    "true",
  );
  evidence.checks.push(
    "Mobile navigation opens and Escape returns to the role",
  );
  assert.equal(evidence.externalRequests, 0);
  assert.deepEqual(evidence.pageErrors, []);
  await writeFile(
    output + "browser-results.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
  await context.close();
} finally {
  await browser.close();
}
