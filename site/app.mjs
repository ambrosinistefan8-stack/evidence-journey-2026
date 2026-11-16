import { loadRuntime } from "./runtime.mjs";
import { describePeer, loadVenueReader } from "./peer.mjs";
import { defaultPeer } from "./settings.mjs";
import { explainInBrowser } from "./model.mjs";

const byId = id => document.getElementById(id);
let runtime;
let lang = "de";
let lastRun;
let venueLookup;
let currentExplanation;
const choose = (de, en) => lang === "de" ? de : en;
const time = minute => String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
const add = (parent, tag, value, className) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  parent.append(el);
  return el;
};
const sourceLabel = source => "[" + source.id + "] " + source[lang];

function draw(plan) {
  const { event, mobility, access, trace, preference } = plan;
  const outcome = byId("outcome");
  const state = access.state;
  const stepFree = preference === "stepFree";
  const outcomes = {
    unknown: choose("Samstag nicht bestätigt", "Saturday unconfirmed"),
    conflicting: choose("Quellen widersprechen sich", "Sources disagree"),
    open: choose("Öffnung am Samstag bestätigt", "Saturday opening confirmed"),
    closed: choose("Seiteneingang geschlossen", "Side entrance closed")
  };
  outcome.textContent = outcomes[state];
  outcome.dataset.state = state;
  byId("explain").textContent = {
    unknown: choose("Die Halleninfo gilt am Freitag. Kläre vor der Fahrt, ob der Seiteneingang auch am Samstag geöffnet ist.", "The venue notice applies to Friday. Check whether the side entrance is open on Saturday before travelling."),
    conflicting: choose("Halle und Veranstalter machen unterschiedliche Angaben. Lass dir die Öffnung für Samstag bestätigen.", "The venue and organiser disagree. Ask them to confirm Saturday's opening."),
    open: choose("Die unten aufgeführten Belege bestätigen den stufenlosen Seiteneingang für den Veranstaltungstag.", "The evidence below confirms the step-free side entrance for the event day."),
    closed: choose("Kläre mit der Halle, welchen Eingang du benutzen kannst.", "Ask the venue which entrance you can use.")
  }[state];
  const refs = byId("source-list");
  refs.replaceChildren();
  for (const record of [...access.records, ...access.outOfDate]) {
    const label = choose(record.state === "open" ? "offen" : "geschlossen", record.state);
    add(refs, "p", sourceLabel(record.source) + " · " + label, "source");
  }
  const route = mobility.choice;
  const steps = byId("steps");
  steps.replaceChildren();
  const rows = [
    [choose("Verbindung", "Connection"), route
      ? choose(route.name, route.english) + " · " + choose("Ankunft ", "Arrives ") + time(route.arrives)
      : choose("Keine passende Verbindung", "No matching connection"), sourceLabel(mobility.source)],
    [choose("Weg zur Halle", "Walk to the venue"), route
      ? route.walk + choose(" Min. bis zur Halle", " min to the venue") + " · " +
        (route.stepFree ? choose("stufenlos", "step-free") : choose("mit Stufen", "has steps"))
      : choose("Hier fehlt eine geeignete Route.", "A suitable route still needs to be found."), sourceLabel(mobility.source)],
    [choose("Seiteneingang", "Side entrance"), outcomes[state],
      access.records.length ? access.records.map(record => "[" + record.source.id + "]").join(" ") :
        choose("Beleg für den richtigen Tag fehlt", "No evidence for this date")],
    [choose("Veranstaltung", "Event"), event.name + " · " + time(event.starts),
      choose("Einlass ab ", "Doors at ") + time(event.doors) + " · " + sourceLabel(event.source)]
  ];
  for (const [label, title, ref] of rows) {
    const li = add(steps, "li", "", "step");
    add(li, "span", label, "step-label");
    add(li, "strong", title);
    add(li, "span", ref, "step-source");
  }
  const alt = byId("alternatives");
  alt.replaceChildren();
  for (const candidate of mobility.routes.filter(item => item.id !== route?.id)) {
    const reason = candidate.exclusion === "late" ?
      choose("zu spät an der Halle", "reaches the venue too late") :
      candidate.exclusion === "steps" ? choose("enthält Treppen", "includes stairs") :
      choose("längerer Fussweg", "longer walk");
    add(alt, "li", choose(candidate.name, candidate.english) + " · " + candidate.walk + " min · " + reason);
  }
  byId("trace").textContent = choose("Aufrufe: ", "Calls: ") + trace.join(" → ");
  byId("result").hidden = false;
}

function run() {
  currentExplanation?.abort();
  byId("local-ai-output").textContent = "";
  try {
    lastRun = runtime.run({ scenario: byId("scenario").value, preference: byId("preference").value }, venueLookup);
    draw(lastRun);
    byId("error").hidden = true;
  } catch {
    byId("result").hidden = true;
    byId("error").hidden = false;
    byId("error").textContent = choose("Der Weg konnte nicht geprüft werden.", "The route could not be checked.");
  }
}

byId("language").addEventListener("click", () => {
  lang = lang === "de" ? "en" : "de";
  document.documentElement.lang = lang === "de" ? "de-CH" : "en";
  byId("language").textContent = choose("EN", "DE");
  byId("language").setAttribute("aria-label", choose("Switch to English", "Auf Deutsch wechseln"));
  for (const el of document.querySelectorAll("[data-de][data-en]")) el.textContent = el.dataset[lang];
  if (lastRun) draw(lastRun);
});
byId("run").addEventListener("click", run);
const isLocal = location.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
byId("local-ai").hidden = !isLocal;
byId("local-ai-run").addEventListener("click", async () => {
  const status = byId("local-ai-status");
  const output = byId("local-ai-output");
  const button = byId("local-ai-run");
  if (!lastRun || !isLocal) return;
  currentExplanation = new AbortController();
  const signal = AbortSignal.any([currentExplanation.signal, AbortSignal.timeout(60000)]);
  output.textContent = "";
  status.textContent = choose("Lokales Modell formuliert …", "Local model is writing …");
  button.disabled = true;
  try {
    await explainInBrowser(lastRun, lang, value => { output.textContent = value; }, signal);
    status.textContent = choose("Erklärung aus den Beispieldaten", "Explanation from sample records");
  } catch {
    output.textContent = "";
    status.textContent = choose("Lokale Erklärung derzeit nicht verfügbar.", "Local explanation is unavailable.");
  } finally {
    button.disabled = false;
  }
});
byId("peer").value = defaultPeer;
byId("partner-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("partner-status");
  const button = byId("partner-run");
  try {
    const addr = byId("peer").value.trim();
    const { origin } = describePeer(addr);
    if (origin === location.origin) throw new Error("Expected a separate origin");
    const message = choose("Öffentliche Demo-Belege von " + origin + " laden?", "Load public demo evidence from " + origin + "?");
    if (!confirm(message)) {
      status.textContent = choose("Abfrage abgebrochen.", "Request cancelled.");
      return;
    }
    button.disabled = true;
    status.textContent = choose("Demo-Belege werden geladen …", "Loading demo evidence …");
    venueLookup = await loadVenueReader(addr, true);
    byId("partner-remove").disabled = false;
    status.textContent = choose("Demo-Belege geladen von ", "Demo evidence loaded from ") + origin;
    run();
  } catch {
    status.textContent = choose("Das Demo-Hallenregister konnte nicht gelesen werden.", "The demo venue registry could not be read.");
  } finally {
    button.disabled = false;
  }
});
byId("partner-remove").addEventListener("click", () => {
  venueLookup = undefined;
  byId("partner-remove").disabled = true;
  byId("partner-status").textContent = choose("Zusatzbeleg entfernt.", "Extra evidence removed.");
  run();
});
try {
  runtime = await loadRuntime();
  byId("run").disabled = false;
  run();
} catch {
  byId("error").hidden = false;
  byId("error").textContent = choose("Die Projektdaten konnten nicht geladen werden.", "The project data could not be loaded.");
}
