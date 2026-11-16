import { evidence } from "./evidence.mjs";

const localHandlers = {
  event() {
    return evidence.event;
  },
  mobility({ preference, arriveBy }) {
    const routes = evidence.routes.map(route => {
      const readyAt = route.arrives + route.walk;
      const exclusion = readyAt > arriveBy ? "late" :
        preference === "stepFree" && !route.stepFree ? "steps" : null;
      return { ...route, readyAt, exclusion };
    }).sort((a, b) => a.walk - b.walk || a.readyAt - b.readyAt);
    return {
      choice: routes.find(route => route.exclusion === null) ?? null,
      routes,
      source: evidence.transitSource
    };
  },
  access({ scenario, date }, _, venueLookup) {
    const records = evidence.entrances[scenario];
    const matched = [...records.filter(record => record.date === date), ...(venueLookup?.(date) ?? [])];
    const states = new Set(matched.map(record => record.state));
    const state = matched.length === 0 ? "unknown" : states.size > 1 ? "conflicting" : matched[0].state;
    return { state, records: matched, outOfDate: records.filter(record => record.date !== date) };
  },
  planner(input, call) {
    const event = call("event", {});
    const mobility = call("mobility", { preference: input.preference, arriveBy: event.arriveBy });
    const access = call("access", { scenario: input.scenario, date: event.date });
    return { event, mobility, access, preference: input.preference };
  }
};

function checkInput(value, schema) {
  if (!schema || schema.type !== "object" || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an object with declared inputs");
  }
  const { properties = {}, required = [], additionalProperties = false } = schema;
  for (const name of required) {
    if (!Object.hasOwn(value, name)) throw new TypeError("Missing input: " + name);
  }
  for (const [name, field] of Object.entries(value)) {
    if (!Object.hasOwn(properties, name)) {
      if (!additionalProperties) throw new TypeError("Unexpected input: " + name);
      continue;
    }
    const rule = properties[name];
    const matchesType = rule.type === "integer" ? Number.isInteger(field) : typeof field === rule.type;
    if (!matchesType || (rule.enum && !rule.enum.includes(field))) throw new TypeError("Invalid input: " + name);
  }
}

export function createRuntime(manifest, definition) {
  if (!Array.isArray(manifest?.networks)) throw new Error("Missing manifest networks");
  const published = manifest.networks.filter(entry => entry.name === "event-way");
  const data = published[0];
  if (published.length !== 1 || data.front_man !== "planner" ||
      definition?.metadata?.name !== data.name || definition.metadata.front_man !== data.front_man ||
      !Array.isArray(definition.tools)) throw new Error("Invalid network identity or front agent");
  const agents = new Map();
  for (const agent of definition.tools) {
    if (!agent || !Object.hasOwn(localHandlers, agent.name) || agents.has(agent.name) ||
        !agent.function?.description || agent.function.parameters?.type !== "object" ||
        !Array.isArray(agent.tools)) throw new Error("Malformed, duplicate or unsupported agent");
    agents.set(agent.name, agent);
  }
  if (agents.size !== Object.keys(localHandlers).length) throw new Error("Missing local agents");
  for (const agent of agents.values()) {
    for (const target of agent.tools) {
      if (!agents.has(target)) throw new Error("Unknown agent: " + target);
    }
  }
  return {
    run(input, venueLookup) {
      const trace = [];
      const call = (name, args, stack = []) => {
        if (trace.length >= 8 || stack.includes(name)) throw new Error("Agent call limit reached");
        const agent = agents.get(name);
        checkInput(args, agent.function.parameters);
        trace.push(name);
        return localHandlers[name](args, (target, targetArgs) => {
          if (!agent.tools.includes(target)) throw new Error("Undeclared agent call: " + target);
          return call(target, targetArgs, [...stack, name]);
        }, venueLookup);
      };
      const result = call(data.front_man, input);
      return { ...result, trace };
    }
  };
}

export async function loadRuntime() {
  const get = async url => {
    const response = await fetch(url, { credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error("Could not read agent definition (" + response.status + ")");
    return await response.json();
  };
  const home = new URL("./", import.meta.url);
  const manifest = await get(new URL("./agent-manifest.json", home));
  const published = manifest?.networks?.find(entry => entry.name === "event-way");
  if (typeof published?.hocon !== "string") throw new Error("Missing event-way network");
  const definition = new URL(published.hocon, home);
  if (definition.origin !== home.origin || definition.pathname !== new URL("./event-way.network.json", home).pathname) {
    throw new Error("Unsupported agent definition location");
  }
  return createRuntime(manifest, await get(definition));
}
