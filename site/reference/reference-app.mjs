import { Engine } from "./runtime/engine.js";
import { loadRuntime } from "../runtime.mjs";
import { createVenueReader } from "../peer.mjs";

const peerOrigin = "https://veranstaltungsweg-venue-record.vercel.app";
const peerNetwork = peerOrigin + "/venue-record";

const byId = id => document.getElementById(id);
const routerControl = byId("router");
const modelControl = byId("model");
const localDevelopment = location.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const ollamaURL = "http://127.0.0.1:11434/v1";
if (localDevelopment) {
  routerControl.value = ollamaURL;
  modelControl.value = "qwen3:4b-instruct";
}

function appendActivity(value) {
  const li = document.createElement("li");
  li.textContent = value;
  byId("activity").append(li);
}

async function run(event) {
  event.preventDefault();
  const status = byId("model-status");
  const result = byId("model-answer");
  const button = byId("start");
  let engine;
  try {
    const router = new URL(routerControl.value.trim());
    const local = localDevelopment && router.href.replace(/\/$/, "") === ollamaURL;
    if ((!local && router.protocol !== "https:") || router.username || router.password || router.hash || router.search) {
      throw new Error("Use an HTTPS router with no credentials or query in the address.");
    }
    const key = local ? "ollama" : byId("key").value.trim();
    if (!key) throw new Error("Enter the key for the selected model provider, or use the key-free example on the main page.");
    if (!window.confirm("Use the selected provider at " + router.origin + " for these fictional records?")) return;
    byId("key").value = "";
    button.disabled = true;
    byId("activity").replaceChildren();
    result.textContent = "";
    status.textContent = "Preparing browser agents…";
    const site = new URL("./", import.meta.url).href;
    engine = new Engine({
      originUrl: site,
      routerOverride: router.href,
      modelOverride: modelControl.value.trim(),
      byokKey: key,
      sandboxWorkerUrl: new URL("./runtime/sandbox-worker.js", site).href
    });
    const wantsPeer = byId("use-peer").checked;
    engine.onConsent = async () => "decline";
    await engine.loadTop();
    // The explicit UI action below controls peer contact. Avoid a second,
    // model-selected call, which could duplicate cost or skip the user's choice.
    const specialist = engine.top.network.getAgentSpec("entrance_specialist");
    specialist.tools = specialist.tools.filter(tool => tool !== peerNetwork);
    let peerLookup;
    if (wantsPeer && window.confirm("Allow this browser to load the public fictional venue network from " + peerOrigin + "? It will run with your selected model provider; that provider's rates and limits apply.")) {
      status.textContent = "Loading the approved venue network…";
      try {
        const session = await engine.resolveRemote(peerNetwork, [], undefined);
        const peerAnswer = await session.invoke({ user_message: { text: "What is the record for 2026-11-21? Include the source ID." }, sly_data: {} });
        if (typeof peerAnswer !== "object" || !/\bP01\b/.test(peerAnswer.text || "") || !/2026-11-21|November 21|21 November/i.test(peerAnswer.text || "")) {
          throw new Error("Unverifiable answer");
        }
        peerLookup = createVenueReader(session.manifest, session.network.config);
      } catch {
        throw new Error("The approved venue network could not be loaded or verified.");
      }
      appendActivity("Agent: venue-record / lookup");
    }
    const scenario = byId("case").value;
    const deterministic = await loadRuntime();
    const activities = new Set();
    const access = deterministic.run({ scenario, preference: "stepFree" }, peerLookup).access;
    const expectedSources = [...access.records, ...access.outOfDate].map(record => record.source.id);
    let answer;
    const stream = engine.streamTurn(
      "Ask entrance_specialist to use the website evidence for the scenario " + scenario + ". " + (peerLookup ? "The separately approved venue agent also reported source P01: the fictional entrance is open on Saturday 2026-11-21. Account for this in the answer." : "No separate venue agent was used.") + " Explain what to check about Saturday's entrance."
    );
    for await (const item of stream) {
      if (item.type === "agent.started") {
        const name = item.source?.agent;
        if (name && !activities.has(name)) {
          activities.add(name);
          appendActivity("Agent: " + name);
        }
      } else if (item.type === "tool.completed") {
        const tool = item.tool?.name;
        if (tool && !activities.has(tool)) {
          activities.add(tool);
          appendActivity("Tool: " + tool);
        }
      } else if (item.type === "agent.output.delta" && item.visibility === "user") {
        status.textContent = "Receiving the model explanation…";
      } else if (item.type === "turn.completed") {
        answer = item.result;
      }
    }
    if (!answer?.text) throw new Error("The model returned no answer.");
    // A model can cite real IDs while making a false claim about those sources.
    // Render the independently computed evidence decision, not generated prose.
    const facts = {
      unknown: "Saturday is unconfirmed. The available notice applies to Friday.",
      open: "The venue evidence reports a Saturday opening.",
      conflicting: "The venue and organiser give conflicting Saturday reports."
    };
    result.textContent = facts[access.state] + " Source records: " + expectedSources.join(", ") + ".";
    status.textContent = "Model response received from " + router.origin + ". The displayed outcome is calculated from the source records; model wording is not treated as verified evidence.";
    if (wantsPeer && !peerLookup) status.textContent += " The separate venue agent was not run; no additional venue evidence was used.";
  } catch (error) {
    const message = error instanceof Error && /^(Use an HTTPS|Enter the key|The model returned|The approved venue network)/.test(error.message) ?
      error.message : "The configured model could not be reached or did not finish a valid run.";
    result.textContent = "";
    status.textContent = message;
  } finally {
    if (engine) {
      engine.byokKey = "";
      if (engine.top?.llm) engine.top.llm.apiKey = "";
    }
    button.disabled = false;
  }
}
byId("setup").addEventListener("submit", run);
