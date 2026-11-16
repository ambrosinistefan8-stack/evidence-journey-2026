import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 5812;
const publicFiles = new Set(["agent-manifest.json", "venue-record.network.json", "links.json", "index.html"]);
createServer(async (request, reply) => {
  const path = request.url === "/" ? "index.html" : request.url.slice(1);
  if (!publicFiles.has(path) || request.method !== "GET") {
    reply.writeHead(404).end("Not found");
    return;
  }
  try {
    const content = await readFile(new URL("./peer/" + path, import.meta.url));
    reply.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": path.endsWith(".json") ? "application/json; charset=utf-8" : "text/html; charset=utf-8"
    }).end(content);
  } catch {
    reply.writeHead(500).end("Demo data unavailable");
  }
}).listen(port, host, () => console.log("Venue fixture: http://" + host + ":" + port + "/venue-record"));
