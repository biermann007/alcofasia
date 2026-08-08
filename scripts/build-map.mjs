import { readFile, writeFile } from "node:fs/promises";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const ASIA_COUNTRY_CODES = new Set([
  "004", "031", "048", "050", "051", "064", "096", "104", "116",
  "144", "156", "158", "196", "268", "275", "344", "356", "360",
  "364", "368", "376", "392", "398", "400", "408", "410", "414",
  "417", "418", "422", "446", "458", "462", "496", "512", "524",
  "586", "608", "626", "634", "643", "682", "702", "704", "760",
  "762", "764", "784", "792", "795", "860", "887"
]);

const atlas = JSON.parse(
  await readFile(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8")
);

const asiaTopology = {
  ...atlas,
  objects: {
    ...atlas.objects,
    countries: {
      ...atlas.objects.countries,
      geometries: atlas.objects.countries.geometries.filter(({ id }) =>
        ASIA_COUNTRY_CODES.has(id)
      )
    }
  }
};

const asia = feature(asiaTopology, asiaTopology.objects.countries);
const projection = geoMercator()
  .rotate([-95, 0])
  .fitExtent([[32, 30], [968, 570]], asia);
const path = geoPath(projection);

const countries = asia.features
  .map((country) => `    <path d="${path(country)}" />`)
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-labelledby="title description">
  <title id="title">Karte von Asien</title>
  <desc id="description">Stilisierte Länderflächen und Grenzen ohne Beschriftungen.</desc>
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
  <ellipse cx="500" cy="325" rx="440" ry="245" fill="url(#halo)" />
  <g fill="url(#land)" stroke="#181818" stroke-width="1.35" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#shadow)">
${countries}
  </g>
</svg>
`;

await writeFile(new URL("../public/asia.svg", import.meta.url), svg);
