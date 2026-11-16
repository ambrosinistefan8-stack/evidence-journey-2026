import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EVIDENCE_PLAYWRIGHT_PATH ?? "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const requests = [];
page.on("request", request => {
  if (request.url().startsWith("http://127.0.0.1:11434/") && request.method() === "POST") {
    requests.push(request.url());
  }
});
try {
  await page.goto("http://127.0.0.1:5811/reference/");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Run model explanation" }).click();
  await page.waitForFunction(() => !document.getElementById("start").disabled, null, { timeout: 115000 });
  const status = await page.locator("#model-status").textContent();
  const activity = await page.locator("#activity").textContent();
  const answer = await page.locator("#model-answer").textContent();
  console.log(JSON.stringify({ status, activity, answer, localModelRequests: requests.length }));
  assert.match(status, /Model response/);
  assert.match(activity, /journey_guide/);
  assert.match(activity, /entrance_specialist/);
  assert.match(activity, /website_read_journey/);
  assert.match(answer, /Saturday/);
  assert.match(answer, /not|unconfirmed|unknown|uncertain/i);
  assert.match(answer, /F03/);
  assert.doesNotMatch(answer, /cruse-\d+/);
  assert.ok(requests.length > 0 && requests.every(url => url === "http://127.0.0.1:11434/v1/chat/completions"));
} finally {
  await browser.close();
}
