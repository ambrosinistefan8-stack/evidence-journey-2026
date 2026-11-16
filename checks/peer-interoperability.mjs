// Isolated, real-model peer portability check. No public data or keys are sent.
// Run with local Ollama + qwen3:4b-instruct and EVIDENCE_PLAYWRIGHT_PATH set.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.EVIDENCE_PLAYWRIGHT_PATH || 'playwright-core');
const home = path.resolve(import.meta.dirname, '..');
async function serve(directory) {
  const root = path.join(home, directory);
  const server = createServer(async (req, res) => {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    if (name.endsWith('/')) name += 'index.html';
    const filename = path.resolve(root, name);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const data = await readFile(filename);
      const ext = path.extname(filename);
      res.writeHead(200, { 'Content-Type': ({ '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.css':'text/css' })[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin':'*' });
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const main = await serve('site');
const peer = await serve('peer');
let browser;
try {
  const published = JSON.parse(await readFile(path.join(home, 'peer/venue-record.network.json'), 'utf8'));
  const record = published.metadata.evidence_journey_demo.records[0];
  assert.ok(published.tools[0].instructions.includes(record.date));
  assert.ok(published.tools[0].instructions.includes(record.source.id));
  assert.ok(published.tools[0].instructions.includes(record.state));
  browser = await chromium.launch({ headless: true, executablePath: process.env.EVIDENCE_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const page = await browser.newPage();
  let peerRequests = 0;
  let leakedCredential = false;
  page.on('request', req => {
    if (!req.url().startsWith(peer.url)) return;
    peerRequests++;
    if (req.headers().authorization || req.headers().cookie || (req.postData() || '').includes('ollama')) leakedCredential = true;
  });
  await page.goto(main.url + '/reference/');
  const result = await page.evaluate(async ({ peerUrl }) => {
    const { Engine } = await import('./runtime/engine.js');
    const engine = new Engine({ originUrl: location.href, routerOverride: 'http://127.0.0.1:11434/v1', modelOverride: 'qwen3:4b-instruct', byokKey: 'ollama' });
    await engine.loadTop();
    let denied = false;
    try { await engine.resolveRemote(peerUrl + '/venue-record', [], undefined); }
    catch (error) { denied = /not in .*allowed_peers/.test(error.message); }
    engine.onConsent = async () => 'allow';
    const decision = await engine.requestConsent({ peerOrigin: peerUrl });
    if (decision !== 'allow') throw new Error('Peer approval missing');
    engine.runtimeAllowedPeers.add(peerUrl);
    const session = await engine.resolveRemote(peerUrl + '/venue-record', [], undefined);
    const reply = await session.invoke({ user_message: { text: 'What is the record for 2026-11-21? Include the source ID.' }, sly_data: {} });
    return { denied, network: session.network.name, router: session.llm.baseUrl, text: typeof reply === 'string' ? reply : reply.text };
  }, { peerUrl: peer.url });
  assert.equal(result.network, 'venue-record');
  assert.equal(result.denied, true, 'an unapproved origin is rejected');
  assert.equal(result.router, 'http://127.0.0.1:11434/v1');
  assert.ok(peerRequests >= 2, 'peer manifest and definition were fetched');
  assert.equal(leakedCredential, false, 'peer requests carry no authorization or cookie');
  assert.match(result.text, /P01/i);
  assert.match(result.text, /2026-11-21|November 21|21 November/i);
  console.log('PASS: independent reference runtime loaded the named peer on a separate loopback origin after simulated approval and ran its fictional record with local Ollama.');
  console.log('Scope: targeted interoperability test only; it does not establish full MVP conformance or a usable public default inference service.');
} finally {
  await browser?.close();
  await Promise.all([new Promise(resolve => main.server.close(resolve)), new Promise(resolve => peer.server.close(resolve))]);
}
