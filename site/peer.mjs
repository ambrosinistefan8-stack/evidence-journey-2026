export function describePeer(address) {
  const url = new URL(address);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new Error("Unsupported peer protocol");
  }
  if (url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/venue-record")) {
    throw new Error("Expected a venue-record network URL");
  }
  return { origin: url.origin, base: new URL("./", url) };
}

export function createVenueReader(manifest, network) {
  const matches = manifest?.networks?.filter(entry => entry.name === "venue-record");
  const agent = network?.tools?.[0];
  const raw = network?.metadata?.evidence_journey_demo;
  if (matches?.length !== 1 || matches[0].front_man !== "lookup" ||
      network.metadata.name !== "venue-record" || network.metadata.front_man !== "lookup" ||
      network.tools?.length !== 1 || agent?.name !== "lookup" || agent.tools?.length !== 0 ||
      raw?.version !== 1 || !Array.isArray(raw.records) || raw.records.length > 10) {
    throw new Error("Unsupported venue network");
  }
  const records = raw.records.map(({ date, state, source }) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !["open", "closed"].includes(state) ||
        ![source?.id, source?.de, source?.en].every(chunk => typeof chunk === "string" && chunk.length > 0 && chunk.length < 90)) {
      throw new Error("Invalid venue record");
    }
    return { date, state, source: { id: source.id, de: source.de, en: source.en } };
  });
  return date => records.filter(record => record.date === date);
}

export async function loadVenueReader(address, originatedByUser, api = fetch) {
  if (originatedByUser !== true) throw new Error("Venue contact was not approved");
  const { base, origin } = describePeer(address);
  const signal = AbortSignal.timeout(5000);
  async function get(url) {
    if (url.origin !== origin) throw new Error("Unexpected venue origin");
    const response = await api(url, { credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal });
    if (!response.ok) throw new Error("Venue data unavailable");
    const payload = await response.text();
    if (payload.length > 30000) throw new Error("Venue response too large");
    return JSON.parse(payload);
  }
  const manifest = await get(new URL("agent-manifest.json", base));
  const candidates = manifest?.networks?.filter(entry => entry.name === "venue-record");
  if (candidates?.length !== 1 || candidates[0].front_man !== "lookup" ||
      typeof candidates[0].hocon !== "string") throw new Error("Published venue network was not found");
  return createVenueReader(manifest, await get(new URL(candidates[0].hocon, base)));
}
