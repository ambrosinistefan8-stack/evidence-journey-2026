import { createRuntime } from "../runtime.mjs";

export async function registerActions(actions) {
  const files = ["agent-manifest.json", "event-way.network.json"];
  const [manifest, graph] = await Promise.all(files.map(async file => {
    const reply = await fetch(new URL("../" + file, import.meta.url), { credentials: "omit", redirect: "error" });
    if (!reply.ok) throw new Error("Journey evidence unavailable");
    return reply.json();
  }));
  const runtime = createRuntime(manifest, graph);
  actions.register({
    name: "read_journey",
    description: "Read the step-free sample journey, dates and source evidence. Select the fixture scenario explicitly.",
    effect: "read",
    inputSchema: {
      type: "object",
      properties: { scenario: { type: "string", enum: ["missing", "confirmed", "conflict"] } },
      required: ["scenario"],
      additionalProperties: false
    },
    execute({ scenario }) {
      const { event, mobility, access } = runtime.run({ scenario, preference: "stepFree" });
      return { event, route: mobility.choice, transitSource: mobility.source, access };
    }
  });
}
