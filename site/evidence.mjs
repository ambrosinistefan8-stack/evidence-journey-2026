export const evidence = Object.freeze({
  event: {
    name: "Lichtwerk Forum",
    venue: "Halle am Kanal",
    date: "2026-11-21",
    doors: 850,
    starts: 870,
    arriveBy: 855,
    source: { id: "F01", de: "Programm · 21. November", en: "Programme · 21 November" }
  },
  routes: [
    { id: "T1", name: "Linie 4", english: "Line 4", arrives: 843, walk: 6, stepFree: true, path: "canal" },
    { id: "T2", name: "Linie 8", english: "Line 8", arrives: 842, walk: 3, stepFree: false, path: "square" },
    { id: "T3", name: "Linie 6", english: "Line 6", arrives: 855, walk: 2, stepFree: true, path: "park" }
  ],
  transitSource: { id: "F02", de: "Fahrplan · Stichprobe", en: "Timetable · sample record" },
  entrances: {
    missing: [{ date: "2026-11-20", state: "open", source: { id: "F03", de: "Halleninfo · Freitag", en: "Venue notice · Friday" } }],
    confirmed: [{ date: "2026-11-21", state: "open", source: { id: "F04", de: "Halleninfo · Samstag", en: "Venue notice · Saturday" } }],
    conflict: [
      { date: "2026-11-21", state: "open", source: { id: "F04", de: "Halleninfo · Samstag", en: "Venue notice · Saturday" } },
      { date: "2026-11-21", state: "closed", source: { id: "F05", de: "Veranstalterinfo · Samstag", en: "Organiser notice · Saturday" } }
    ]
  }
});
