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

const GERMAN_COUNTRY_NAMES = {
  Afghanistan: "Afghanistan",
  Armenia: "Armenien",
  Azerbaijan: "Aserbaidschan",
  Bangladesh: "Bangladesch",
  Bhutan: "Bhutan",
  Brunei: "Brunei",
  Cambodia: "Kambodscha",
  China: "China",
  Cyprus: "Zypern",
  Georgia: "Georgien",
  India: "Indien",
  Indonesia: "Indonesien",
  Iran: "Iran",
  Iraq: "Irak",
  Israel: "Israel",
  Japan: "Japan",
  Jordan: "Jordanien",
  Kazakhstan: "Kasachstan",
  Kuwait: "Kuwait",
  Kyrgyzstan: "Kirgisistan",
  Laos: "Laos",
  Lebanon: "Libanon",
  Malaysia: "Malaysia",
  Mongolia: "Mongolei",
  Myanmar: "Myanmar",
  Nepal: "Nepal",
  "North Korea": "Nordkorea",
  Oman: "Oman",
  Pakistan: "Pakistan",
  Palestine: "Palästina",
  Philippines: "Philippinen",
  Qatar: "Katar",
  Russia: "Russland",
  "Saudi Arabia": "Saudi-Arabien",
  "South Korea": "Südkorea",
  "Sri Lanka": "Sri Lanka",
  Syria: "Syrien",
  Taiwan: "Taiwan",
  Tajikistan: "Tadschikistan",
  Thailand: "Thailand",
  "Timor-Leste": "Osttimor",
  Turkey: "Türkei",
  Turkmenistan: "Turkmenistan",
  "United Arab Emirates": "Vereinigte Arabische Emirate",
  Uzbekistan: "Usbekistan",
  Vietnam: "Vietnam",
  Yemen: "Jemen"
};

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

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
  .map((country) => {
    const name = escapeXml(GERMAN_COUNTRY_NAMES[country.properties.name] ?? country.properties.name);
    return `    <path d="${path(country)}" data-country="${name}" aria-label="${name}" />`;
  })
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
  <style>
    path {
      transition: fill 160ms ease, stroke 160ms ease, opacity 160ms ease;
      cursor: default;
    }

    path:hover {
      fill: #171717;
      stroke: #171717;
      opacity: 0.92;
      cursor: pointer;
    }
  </style>
  <ellipse cx="500" cy="325" rx="440" ry="245" fill="url(#halo)" />
  <g fill="url(#land)" stroke="#181818" stroke-width="1.35" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#shadow)">
${countries}
  </g>
</svg>
`;

await writeFile(new URL("../public/asia.svg", import.meta.url), svg);
