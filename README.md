# Veranstaltungsweg · Evidence Journey

Evidence Journey assembles a fictional step-free event journey from a programme, a timetable and dated access evidence. The default demo is usable in German or English without an account. A separate model mode supports a browser-compatible OpenAI-style router selected by the user.

## Run locally

Start both servers from this folder in separate terminals:

```powershell
py -3 -m http.server 5811 --bind 127.0.0.1 --directory site
node serve-peer.mjs
```

Open http://127.0.0.1:5811/. Choose each entrance scenario and click **Weg prüfen**. The initial case shows why a Friday record cannot establish Saturday access. In **Daten und Ablauf ansehen**, set the demo venue address to http://127.0.0.1:5812/venue-record to test against the local peer. Review and confirm the destination. The public venue address can be tested in the same manner.

The selector for a shorter walk may choose a route with steps. The route card shows that difference explicitly. All routes, sources and times are fictional. The illustrative route line has no geographic coordinates.

The optional reference model mode is at http://127.0.0.1:5811/reference/. With a local Ollama server and the installed qwen3:4b-instruct model, confirm the loopback destination and click the run button. Production visitors need their own compatible HTTPS router and key for this mode. The application clears the input after confirmation and discards the in-memory key at the end of the run. The provider receives the chosen fictional example and tool results and may apply its rates or limits.

## Verification

```powershell
node --test checks/runtime.test.mjs
node checks/browser.mjs
node checks/model-browser.mjs
```

The browser scripts use Playwright and an installed Edge. Install Playwright into a test environment or provide the absolute package folder via EVIDENCE_PLAYWRIGHT_PATH. Both local servers must run for the UI checks. The reference model check also needs Ollama on the local port and the specified model.

For the same browser checks on a published demo, set EVIDENCE_WEB_URL to the main HTTPS site and EVIDENCE_PEER_URL to the venue network URL. Leave the default offline explanation model untouched during the token-free gallery walkthrough.

## Hosting

Publish only two static roots. The `peer/` directory provides the second origin. The `site/` directory provides the planner. The stable venue route is configured in `site/settings.mjs`. On a different host, update that public URL to the new origin plus `/venue-record`. That URL identifies a network. Its manifest and definition are retrieved relative to its base, so no HTTP handler is required at the logical network path. Both directories include Vercel response headers. A different host must preserve HTTPS and CORS access for the JSON manifests, network definitions and link maps.

The public browser check passed at https://veranstaltungsweg-demo.vercel.app/ with https://veranstaltungsweg-venue-record.vercel.app/venue-record as the second origin. The discovery documents returned HTTP 200 with CORS. A local Ollama run exercised both model agents and the read action. It correctly recognised the unknown entrance status but used an invalid source ID in one run. The reference UI now checks IDs against its independent evidence and shows a factual fallback when references cannot be verified. A valid ID is a reference to a record and does not certify every statement in a generated answer.

## Specification and originality

- Competition launch explains this is the first contest, and at preparation time its project gallery had not been published. The related Cognizant challenge recap showed focused workflow demos grounded in real records. Evidence Journey uses this design pattern with original fictional data, layout and implementation. [First competition](https://www.cognizant.com/us/en/ai-lab/blog/open-agentic-web-challenge) · [Gallery](https://cognizant-agenticweb.devpost.com/project-gallery) · [Related winners](https://www.cognizant.com/us/en/ai-lab/blog/multi-agent-ai-hackathon-recap)
- Competition-start reference: [MVP Profile 0.2 pinned to fd872b9](https://github.com/cognizant-ai-labs/agentic-web/blob/fd872b9221aeb8ff762b75a5badbf84b23c133cc/docs/worldwide_agentic_web_mvp_spec.md). The start time comes from [Devpost rules](https://cognizant-agenticweb.devpost.com/rules).
- The main demo uses a bounded browser runtime for the published event-way graph. It demonstrates exact-network lookup and local instantiation of dated public venue data from a second origin. The fixed venue reader is specific to the demo schema. It rejects foreign code and cross-origin redirects. The no-key path is deterministic.
- The separate reference mode uses the upstream browser runtime, declared local read action and a caller-configured model. The vendor files in `site/reference/runtime/` come unchanged from [Cognizant agentic-web at 63a956c](https://github.com/cognizant-ai-labs/agentic-web/tree/63a956cf4653f610b1c238c70946f4d7647d17a8/skills/agentify-website/runtime) under Apache 2.0, with its included license and attribution. Its injected model context contains only original fictional records.
- Core deterministic route checks and the optional model path are independently usable. The entire profile's generalized model-backed peer and MCP interoperability has not been independently certified. The profile describes a default inference path among its checks. The Devpost description makes provider setup optional, and organizer acceptance of the free deterministic default plus user-supplied optional model mode is unverified. Preserve these boundaries in the submission.

The competition requires a public HTTPS project URL, at least one screenshot and a public YouTube browser video under two minutes that features the entrant personally explaining the project. Submission materials must be in English or have an English translation. The user needs to review the final Devpost declarations and personally record the explanation. [Official rules](https://cognizant-agenticweb.devpost.com/rules)
