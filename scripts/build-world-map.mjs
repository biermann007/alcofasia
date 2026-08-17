// Erzeugt public/world.svg – die Kontinentkarte für alcofworld.com – im
// selben Stil wie build-map.mjs die Asien-Karte erzeugt: gleiche Farbwelt,
// gleicher Schatten, gleiche Machart.
//
// Jeder Kontinent ist EINE Fläche (die Länder werden verschmolzen). Welche
// Länder zu Asien gehören, bestimmt nicht der Atlas, sondern dieselbe Liste
// wie in build-map.mjs – damit deckt sich Asien auf der Weltkarte exakt mit
// den 47 Ländern von alcofasia.com (einschließlich Russland und Türkei).
// Alle übrigen Länder werden über world-countries ihrem Erdteil zugeordnet;
// Amerika wird anhand der Subregion in Nord und Süd geteilt.
//
// Aufruf: node scripts/build-world-map.mjs

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, merge } from "topojson-client";

const require = createRequire(import.meta.url);

// Dieselbe Liste wie in build-map.mjs. Sie ist hier bewusst wiederholt statt
// importiert, damit keines der beiden Skripte das andere mitzieht – bei
// Änderungen beide Stellen pflegen.
const ASIA_COUNTRY_CODES = new Set([
  "004", "031", "048", "050", "051", "064", "096", "104", "116",
  "144", "156", "158", "196", "268", "275", "344", "356", "360",
  "364", "368", "376", "392", "398", "400", "408", "410", "414",
  "417", "418", "422", "446", "458", "462", "496", "512", "524",
  "586", "608", "626", "634", "643", "682", "702", "704", "760",
  "762", "764", "784", "792", "795", "860", "887"
]);

// Reihenfolge = Zeichenreihenfolge im SVG.
//
// Die Antarktis fehlt bewusst: Die Projektion drückt sie zu einem breiten
// Streifen am unteren Rand platt – „als ob eine zweite Karte plattgedrückt
// ist" (Robert, 17.08.). Ohne sie füllen die bewohnten Kontinente das Bild.
const KONTINENTE = [
  { key: "asien", de: "Asien", en: "Asia" },
  { key: "europa", de: "Europa", en: "Europe" },
  { key: "afrika", de: "Afrika", en: "Africa" },
  { key: "nordamerika", de: "Nordamerika", en: "North America" },
  { key: "suedamerika", de: "Südamerika", en: "South America" },
  { key: "ozeanien", de: "Ozeanien", en: "Oceania" }
];

// world-countries kennt die Zuordnung Land -> Erdteil über den numerischen
// Ländercode (ccn3), denselben, den auch world-atlas als id trägt.
const laenderdaten = require("world-countries");
const regionVonCcn3 = new Map(
  laenderdaten.filter((l) => l.ccn3).map((l) => [l.ccn3, { region: l.region, subregion: l.subregion }])
);

// Gebiete, die world-atlas ohne (oder ohne gültige) Ländernummer führt.
// Ohne diese Zeilen fielen sie still von der Karte – aufgefallen wäre das
// als Loch im jeweiligen Kontinent.
const NACHTRAEGE_NAME = {
  Kosovo: "europa",
  Somaliland: "afrika",
  "N. Cyprus": "asien"
};

function kontinentVonId(id, name) {
  if (ASIA_COUNTRY_CODES.has(id)) return "asien";
  const eintrag = regionVonCcn3.get(id);
  if (!eintrag) return NACHTRAEGE_NAME[name] ?? null;
  switch (eintrag.region) {
    case "Europe":
      return "europa";
    case "Africa":
      return "afrika";
    case "Asia":
      return "asien";
    case "Oceania":
      return "ozeanien";
    case "Antarctic":
      return null; // bewusst nicht auf der Karte
    case "Americas":
      return eintrag.subregion === "South America" ? "suedamerika" : "nordamerika";
    default:
      return null;
  }
}

const atlas = JSON.parse(
  await readFile(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8")
);

const jeKontinent = new Map(KONTINENTE.map((k) => [k.key, []]));
const unzugeordnet = [];

for (const geometrie of atlas.objects.countries.geometries) {
  const key = kontinentVonId(String(geometrie.id), geometrie.properties?.name);
  if (key && jeKontinent.has(key)) jeKontinent.get(key).push(geometrie);
  else unzugeordnet.push(`${geometrie.id} ${geometrie.properties?.name ?? ""}`);
}

// Antarktis und ihre Gebiete fallen absichtlich heraus – nur Unerwartetes melden.
const wirklichOffen = unzugeordnet.filter((n) => !/Antarctica|Fr\. S\. Antarctic/.test(n));
if (wirklichOffen.length) {
  console.warn(`Nicht zugeordnet (fehlen auf der Karte): ${wirklichOffen.join(", ")}`);
}

// Die Projektion wird über alle Kontinente gemeinsam eingepasst, damit die
// Welt das Bild füllt. Natural Earth statt Mercator: bei einer ganzen
// Weltkarte würde Mercator die Polregionen grotesk aufblasen.
const alleFeatures = feature(atlas, {
  type: "GeometryCollection",
  geometries: [...jeKontinent.values()].flat()
});
const projection = geoNaturalEarth1().fitExtent([[32, 30], [968, 570]], alleFeatures);
const path = geoPath(projection);

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const flaechen = KONTINENTE.filter((k) => jeKontinent.get(k.key).length)
  .map((k) => {
    const verschmolzen = merge(atlas, jeKontinent.get(k.key));
    return `    <path d="${path(verschmolzen)}" data-continent="${escapeXml(k.de)}" data-continent-en="${escapeXml(k.en)}" aria-label="${escapeXml(k.de)}" />`;
  })
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="group" aria-label="Weltkarte der Kontinente">
  <defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfbfb" />
      <stop offset="1" stop-color="#dedede" />
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0" stop-color="#111111" stop-opacity="0.08" />
      <stop offset="1" stop-color="#111111" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="13" flood-color="#000000" flood-opacity="0.12" />
    </filter>
  </defs>
  <ellipse cx="500" cy="325" rx="460" ry="255" fill="url(#halo)" pointer-events="none" />
  <g fill="url(#land)" stroke="#181818" stroke-width="1.35" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#shadow)">
${flaechen}
  </g>
</svg>
`;

await writeFile(new URL("../public/world.svg", import.meta.url), svg);
console.log("public/world.svg geschrieben");
