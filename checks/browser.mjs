import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EVIDENCE_PLAYWRIGHT_PATH ?? "playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let peerRequests = 0;
const peerURL = process.env.EVIDENCE_PEER_URL ?? "http://127.0.0.1:5812/venue-record";
const peerOrigin = new URL(peerURL).origin;
page.on("request", request => {
  if (request.url().startsWith(peerOrigin + "/")) peerRequests += 1;
});
try {
  await page.goto(process.env.EVIDENCE_WEB_URL ?? "http://127.0.0.1:5811/");
  const outcome = page.locator("#outcome");
  await outcome.waitFor({ state: "visible" });
  assert.equal(await outcome.textContent(), "Samstag nicht bestätigt");
  assert.match(await page.locator("#steps").textContent(), /Linie 4.*14:03/s);
  await page.getByRole("button", { name: "Switch to English" }).click();
  assert.equal(await outcome.textContent(), "Saturday unconfirmed");
  await page.locator("#scenario").selectOption("conflict");
  await page.getByRole("button", { name: "Check journey" }).click();
  assert.equal(await outcome.textContent(), "Sources disagree");
  assert.match(await page.locator("#source-list").textContent(), /F04.*F05/s);
  await page.locator("#scenario").selectOption("confirmed");
  await page.locator("#preference").selectOption("shortWalk");
  await page.getByRole("button", { name: "Check journey" }).click();
  assert.equal(await outcome.textContent(), "Saturday opening confirmed");
  assert.match(await page.locator("#steps").textContent(), /Line 8/);
  await page.locator("#scenario").selectOption("missing");
  await page.locator("#preference").selectOption("stepFree");
  await page.getByRole("button", { name: "Check journey" }).click();
  await page.locator("summary").click();
  await page.locator("#peer").fill(peerURL);
  page.once("dialog", dialog => dialog.dismiss());
  const query = page.getByRole("button", { name: "Query demo venue registry" });
  await query.click();
  assert.equal(await page.locator("#partner-status").textContent(), "Request cancelled.");
  assert.equal(peerRequests, 0);
  page.once("dialog", dialog => dialog.accept());
  await query.click();
  await page.getByText("Demo evidence loaded from " + peerOrigin).waitFor();
  assert.equal(await outcome.textContent(), "Saturday opening confirmed");
  assert.match(await page.locator("#source-list").textContent(), /P01/);
  assert.equal(peerRequests, 2);
  await page.locator("summary").click();
  if (process.env.EVIDENCE_SAVE_SCREENSHOT === "1") {
    await page.screenshot({ fullPage: true, path: fileURLToPath(new URL("../jury-preview.png", import.meta.url)) });
  }
  await page.setViewportSize({ width: 375, height: 780 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("Verified desktop and mobile layout, bilingual controls, three evidence cases and consent-gated cross-origin venue data.");
} finally {
  await browser.close();
}
