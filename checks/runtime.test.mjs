import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createRuntime } from "../site/runtime.mjs";
import { createVenueReader, loadVenueReader, describePeer } from "../site/peer.mjs";

async function json(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}
const manifest = await json("../site/agent-manifest.json");
const graph = await json("../site/event-way.network.json");
const peerManifest = await json("../peer/agent-manifest.json");
const peerGraph = await json("../peer/venue-record.network.json");
const runtime = createRuntime(manifest, graph);

test("relevant date, timing and access determine the result, with the attempted agent calls", () => {
  const plan = runtime.run({ scenario: "missing", preference: "stepFree" });
  assert.equal(plan.mobility.choice.id, "T1");
  assert.equal(plan.mobility.choice.readyAt, 849);
  assert.equal(plan.mobility.routes.find(route => route.id === "T3").exclusion, "late");
  assert.equal(plan.mobility.routes.find(route => route.id === "T2").exclusion, "steps");
  assert.equal(plan.access.state, "unknown");
  assert.deepEqual(plan.access.outOfDate.map(record => record.source.id), ["F03"]);
  assert.deepEqual(plan.trace, ["planner", "event", "mobility", "access"]);
});

test("confirmed and contradictory records retain their own source IDs", () => {
  const confirmed = runtime.run({ scenario: "confirmed", preference: "shortWalk" });
  assert.equal(confirmed.mobility.choice.id, "T2");
  assert.equal(confirmed.access.state, "open");
  const conflict = runtime.run({ scenario: "conflict", preference: "stepFree" });
  assert.equal(conflict.access.state, "conflicting");
  assert.deepEqual(conflict.access.records.map(record => record.source.id), ["F04", "F05"]);
});

test("published tool permissions control whether agents may be invoked", () => {
  const incomplete = structuredClone(graph);
  incomplete.tools.find(tool => tool.name === "planner").tools = ["mobility", "access"];
  assert.throws(() => createRuntime(manifest, incomplete).run({ scenario: "missing", preference: "stepFree" }), /Undeclared agent call/);
  assert.throws(() => runtime.run({ scenario: "fake", preference: "stepFree" }), /Invalid input/);
  assert.throws(() => runtime.run({ scenario: "missing", preference: "stepFree", unknown: 42 }), /Unexpected input/);
});

test("second origin record changes the evidence decision without overwriting a conflict", () => {
  const peer = createVenueReader(peerManifest, peerGraph);
  assert.deepEqual(peer("2026-11-20"), []);
  const confirmed = runtime.run({ scenario: "missing", preference: "stepFree" }, peer);
  assert.equal(confirmed.access.state, "open");
  assert.deepEqual(confirmed.access.records.map(record => record.source.id), ["P01"]);
  assert.equal(runtime.run({ scenario: "conflict", preference: "stepFree" }, peer).access.state, "conflicting");
});

test("peer requests require consent and omit credentials, context and redirects", async () => {
  const requests = [];
  const mock = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(url.pathname.endsWith("agent-manifest.json") ? peerManifest : peerGraph));
  };
  const url = "https://venue-demo.example/agents/venue-record";
  await assert.rejects(loadVenueReader(url, false, mock), /not approved/);
  assert.equal(requests.length, 0);
  await loadVenueReader(url, true, mock);
  assert.deepEqual(requests.map(item => item.url.pathname), ["/agents/agent-manifest.json", "/agents/venue-record.network.json"]);
  assert.ok(requests.every(item => item.options.credentials === "omit" && item.options.redirect === "error" && item.url.search === ""));
  assert.throws(() => describePeer("http://venue-demo.example/venue-record"), /protocol/);
  assert.throws(() => describePeer("https://venue-demo.example/venue-record?example=1"), /network URL/);
  const otherOrigin = structuredClone(peerManifest);
  otherOrigin.networks[0].hocon = "https://another.example/network.json";
  let reads = 0;
  await assert.rejects(loadVenueReader(url, true, async () => {
    reads += 1;
    return new Response(JSON.stringify(otherOrigin));
  }), /Unexpected venue origin/);
  assert.equal(reads, 1);
});
