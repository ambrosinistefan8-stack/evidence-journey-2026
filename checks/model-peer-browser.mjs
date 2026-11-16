// Browser integration test for the optional model + peer path.
// Uses local Ollama and intercepts only the public demo peer with local fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EVIDENCE_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, 'site');
const server = createServer(async (req, res) => {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  if (name.endsWith('/')) name += 'index.html';
  const filename = path.resolve(site, name);
  if (!filename.startsWith(site + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(filename);
    const ext = path.extname(filename);
    res.writeHead(200, { 'Content-Type': ({ '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.css':'text/css' })[ext] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  let peerRequests = 0, approvals = 0, credentialsLeaked = false;
  await page.route('https://veranstaltungsweg-venue-record.vercel.app/**', async route => {
    const req = route.request();
    peerRequests++;
    if (req.headers().authorization || req.headers().cookie) credentialsLeaked = true;
    const name = new URL(req.url()).pathname.slice(1);
    if (!['agent-manifest.json', 'venue-record.network.json', 'links.json'].includes(name)) return route.abort();
    const body = await readFile(path.join(root, 'peer', name));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin':'*' }, body });
  });
  let declinePeer = true;
  page.on('dialog', async dialog => { approvals++; if (declinePeer && approvals === 2) await dialog.dismiss(); else await dialog.accept(); });
  await page.goto(`http://127.0.0.1:${server.address().port}/reference/`);
  await page.locator('#use-peer').check();
  // Refusing the peer must prevent even its manifest from being requested.
  // Abort the later model request because only the consent boundary is under test.
  const modelPattern = 'http://127.0.0.1:11434/v1/chat/completions';
  await page.route(modelPattern, route => route.abort());
  await page.locator('#start').click();
  await page.waitForFunction(() => !document.getElementById('start').disabled, null, { timeout: 30000 });
  assert.equal(approvals, 2);
  assert.equal(peerRequests, 0, 'declining peer consent prevents all peer requests');
  await page.unroute(modelPattern);
  await page.reload();
  approvals = 0;
  declinePeer = false;
  await page.locator('#use-peer').check();
  await page.locator('#start').click();
  await page.waitForFunction(() => !document.getElementById('start').disabled, null, { timeout: 120000 });
  const status = await page.locator('#model-status').textContent();
  const activity = await page.locator('#activity').textContent();
  const answer = await page.locator('#model-answer').textContent();
  console.log(JSON.stringify({ status, activity, answer, peerRequests, approvals, credentialsLeaked }));
  assert.match(status, /Model response/);
  assert.match(activity, /journey_guide/);
  assert.match(activity, /entrance_specialist/);
  assert.match(activity, /lookup/);
  assert.match(answer, /P01/);
  assert.match(answer, /Saturday opening/);
  assert.doesNotMatch(answer, /unconfirmed/i);
  assert.equal(credentialsLeaked, false);
  assert.ok(peerRequests >= 2 && approvals >= 2);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
