import { Engine } from "./runtime/engine.js";
import { loadRuntime } from "../runtime.mjs";

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
    engine.onConsent = async () => "decline";
    await engine.loadTop();
    const scenario = byId("case").value;
    const deterministic = await loadRuntime();
    const access = deterministic.run({ scenario, preference: "stepFree" }).access;
    const expectedSources = [...access.records, ...access.outOfDate].map(record => record.source.id);
    const activities = new Set();
    let answer;
    const stream = engine.streamTurn(
      "Ask entrance_specialist to use the website evidence for the scenario " + scenario + ". Explain what to check about Saturday's entrance."
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
    const explanation = answer.text.slice(0, 9000);
    const cited = explanation.match(/\b(?:[A-Z]\d{2}|cruse-\d+)\b/gi) ?? [];
    const known = new Set(["F01", "F02", ...expectedSources]);
    const citationsMatch = expectedSources.every(id => cited.includes(id)) && cited.every(id => known.has(id));
    if (citationsMatch) {
      result.textContent = explanation;
      status.textContent = "Model response from " + router.origin + ". Check the cited evidence in the main demo.";
    } else {
      const facts = {
        unknown: "Saturday is unconfirmed. The available notice applies to Friday.",
        open: "The venue evidence reports a Saturday opening.",
        conflicting: "The venue and organiser give conflicting Saturday reports."
      };
      result.textContent = facts[access.state] + " Source records: " + expectedSources.join(", ") + ".";
      status.textContent = "Model response received. Its source IDs could not be verified, so the documented facts are shown.";
    }
  } catch (error) {
    const message = error instanceof Error && /^(Use an HTTPS|Enter the key|The model returned)/.test(error.message) ?
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
