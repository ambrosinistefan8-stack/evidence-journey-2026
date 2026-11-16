// Local recording of the public fictional demo. Requires playwright-core and Edge.
// It contains English explanatory captions and no voice.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EVIDENCE_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const captureDir = path.join(root, 'video-zwischenstand');
await mkdir(captureDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, recordVideo: { dir: captureDir, size: { width: 1280, height: 960 } } });
const page = await context.newPage();
const movie = page.video();
const pause = n => page.waitForTimeout(n);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('https://veranstaltungsweg-demo.vercel.app/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.locator('#outcome').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#outcome').textContent(), 'Saturday unconfirmed');
  await page.evaluate(() => { document.documentElement.style.zoom = '0.86'; });
  const caption = text => page.evaluate(value => {
    let box = document.querySelector('#recording-caption');
    if (!box) {
      box = document.createElement('div'); box.id = 'recording-caption';
      Object.assign(box.style, { position: 'fixed', bottom: '2.5%', left: '12%', width: '76%', zIndex: '2147483647', padding: '14px 20px', boxSizing: 'border-box', borderRadius: '12px', background: 'rgba(15, 29, 38, 0.94)', color: 'white', textAlign: 'center', font: '600 23px/1.35 sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,.35)' });
      document.body.append(box);
    }
    box.textContent = value;
  }, text);
  await caption('Evidence Journey helps people plan a visit to an event, right down to the entrance.');
  await pause(9000);
  await page.locator('#outcome').scrollIntoViewIfNeeded();
  await caption('For step-free travel, Line 4 arrives on time. A Friday notice cannot confirm Saturday’s entrance.');
  await pause(12000);
  await page.locator('#scenario').selectOption('conflict');
  await page.locator('#run').click();
  assert.equal(await page.locator('#outcome').textContent(), 'Sources disagree');
  assert.match(await page.locator('#source-list').textContent(), /F04.*F05/s);
  await page.locator('#outcome').scrollIntoViewIfNeeded();
  await caption('Two Saturday sources disagree. Both remain visible, so the visitor can see what needs checking.');
  await pause(12000);
  await page.locator('#scenario').selectOption('missing');
  await page.locator('#run').click();
  await page.locator('summary').click();
  await page.locator('#peer').fill('https://veranstaltungsweg-venue-record.vercel.app/venue-record');
  await page.locator('#partner-run').scrollIntoViewIfNeeded();
  await caption('With approval, the browser checks a separate fictional venue registry for another record.');
  await pause(4000);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#partner-run').click();
  await page.getByText('Demo evidence loaded from https://veranstaltungsweg-venue-record.vercel.app').waitFor();
  assert.equal(await page.locator('#outcome').textContent(), 'Saturday opening confirmed');
  assert.match(await page.locator('#source-list').textContent(), /P01/);
  await pause(4000);
  await page.locator('summary').click();
  await page.locator('#outcome').scrollIntoViewIfNeeded();
  await caption('The new record is for Saturday. The route and supporting evidence stay together. All demo data is fictional.');
  await pause(20000);
  assert.deepEqual(errors, []);
  await context.close();
  const temporary = await movie.path();
  const target = path.join(root, 'jury-demo-englisch.webm');
  await rename(temporary, target);
  console.log(`Recorded verified public demo (silent): ${target}`);
} finally {
  await context.close().catch(() => {});
  await browser.close();
}
