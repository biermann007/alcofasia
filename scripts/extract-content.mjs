// Überführt die heute von Hand gepflegten Inhalte in strukturierte Daten.
//
// Quellen:
//   public/index.html       – Detailartikel je Land und die Farbwelt im CSS
//   public/list/index.html  – Tabellenspalten, die es nur auf der Listenseite gibt
//   public/site-ui.js       – deutsch-englisches Wörterbuch und Ländernamen
//   public/asia.svg         – die 47 Länder, die die Karte kennt
//
// Ergebnis:
//   content/seed.json       – lesbarer Zwischenstand zum Prüfen
//   migrations/0002_seed.sql – Insert-Anweisungen für D1
//
// Das Skript ist bewusst streng: fehlt eine englische Entsprechung oder passt
// ein Ländername nicht zur Karte, bricht es mit einer Meldung ab, statt
// stillschweigend Lücken zu erzeugen.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseHTML } from "linkedom";

const root = new URL("../", import.meta.url);

// Einmalige Migration: liest den Stand VOR der Umstellung. Standardmäßig aus
// public/, sonst aus dem als Argument übergebenen Verzeichnis. Nach der
// Umstellung liegen die alten Dateien nur noch in der Git-Historie:
//   git worktree add /tmp/alt <commit-vor-der-umstellung>
//   node scripts/extract-content.mjs /tmp/alt/public
const quelle = process.argv[2] ?? new URL("public", root).pathname;
const read = (p) => readFile(`${quelle}/${p.replace(/^public\//, "")}`, "utf8");

const problems = [];
const note = (msg) => problems.push(msg);

// ---------------------------------------------------------------- Wörterbuch

const uiSource = await read("public/site-ui.js");

const evalObject = (source, name) => {
  const start = source.indexOf(`const ${name} = {`);
  if (start === -1) throw new Error(`Objekt ${name} nicht in site-ui.js gefunden`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = open;
  let inString = null;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inString = c;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return new Function(`return ${source.slice(open, end + 1)}`)();
};

const countryNames = evalObject(uiSource, "countryNames"); // deutsch -> englisch
const english = evalObject(uiSource, "english");           // deutscher Satz -> englischer Satz

// Übersetzung nachschlagen. Erst das Satzwörterbuch, dann die Ländernamen.
//
// Fehlt ein Eintrag, ist der Text in beiden Sprachen gleich – genau so verhält
// sich die Seite heute schon (english[de] || countryNames[de] || de). Das gilt
// für Eigennamen wie "Baijiu" oder Stufen wie "Premium" und ist kein Fehler.
// Gemeldet wird nur, wenn der deutsche Text erkennbar deutsch ist und trotzdem
// keine Entsprechung hat – das wäre eine echte Lücke.
const DEUTSCH = /[äöüßÄÖÜ]|\b(und|oder|mit|ohne|der|die|das|nicht|kein|keine|derzeit|Vol\.|Hersteller|Spirituose|Sortiment|Herkunft|Zutaten|Kategorie|Stufe|erhältlich|Abfüllung|Alkoholgehalt|Einordnung|Verkauf)\b/;

const en = (de, kontext) => {
  if (de == null) return null;
  const text = de.trim();
  if (!text || text === "–") return text;
  const hit = english[text] ?? countryNames[text];
  if (hit === undefined) {
    if (DEUTSCH.test(text)) note(`Keine englische Fassung für ${kontext}: "${text.slice(0, 70)}"`);
    return text; // in beiden Sprachen identisch
  }
  return hit;
};

// ------------------------------------------------------------------- Karte

const svg = await read("public/asia.svg");
const mapCountries = new Set(
  [...svg.matchAll(/data-country="([^"]*)"/g)].map((m) =>
    m[1].replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&lt;", "<")
  )
);

// ------------------------------------------------------------ Detailartikel

const indexHtml = await read("public/index.html");
const { document } = parseHTML(indexHtml);

const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);

const TIER_BY_LABEL = {
  Low: "low",
  Standard: "standard",
  Premium: "premium",
  "Keine Kategorie": "keine"
};

const slugify = (name) =>
  name
    .toLowerCase()
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const readProducts = (container, countryName) =>
  [...container.querySelectorAll(":scope > .product-card, :scope > .product-grid > .product-card")].map(
    (card, i) => {
      const tierLabel = text(card.querySelector(".product-label"));
      const tier = TIER_BY_LABEL[tierLabel];
      if (!tier) note(`${countryName}: unbekannte Produktstufe "${tierLabel}"`);
      return {
        position: i,
        tier: tier ?? "low",
        tier_label_de: tierLabel,
        tier_label_en: en(tierLabel, `${countryName} Stufe`),
        tier_list_de: null,
        tier_list_en: null,
        name: text(card.querySelector(".product-name")),
        meta_de: text(card.querySelector(".product-meta")),
        meta_en: en(text(card.querySelector(".product-meta")), `${countryName} Produktzeile`),
        description_de: text(card.querySelector(".product-description")),
        description_en: en(text(card.querySelector(".product-description")), `${countryName} Produkttext`),
        availability_de: text(card.querySelector(".availability")),
        availability_en: en(text(card.querySelector(".availability")), `${countryName} Verfügbarkeit`)
      };
    }
  );

const countries = [];
let dokumentReihenfolge = 0;

for (const article of document.querySelectorAll("[data-country-detail]")) {
  const nameDe = article.getAttribute("data-country-detail");
  if (!mapCountries.has(nameDe)) note(`"${nameDe}" hat einen Detailartikel, kommt aber nicht in asia.svg vor`);

  const kicker = text(article.querySelector(".country-kicker"));
  if (kicker !== nameDe) note(`${nameDe}: Kicker "${kicker}" weicht vom data-country-detail ab`);

  const paragraphs = [...article.querySelectorAll(".country-copy:not(.country-note) p")].map((p, i) => ({
    position: i,
    text_de: text(p),
    text_en: en(text(p), `${nameDe} Absatz ${i + 1}`)
  }));

  const facts = [...article.querySelectorAll(".spirit-facts > div")].map((row, i) => {
    const labelDe = text(row.querySelector("dt"));
    const valueDe = text(row.querySelector("dd"));
    return {
      position: i,
      label_de: labelDe,
      label_en: en(labelDe, `${nameDe} Faktenname`),
      value_de: valueDe,
      value_en: en(valueDe, `${nameDe} Faktenwert`)
    };
  });

  const producers = [...article.querySelectorAll(".manufacturer-block")].map((block, i) => {
    const labelDe = text(block.querySelector(":scope > .product-label"));
    return {
      position: i + 1,
      name: text(block.querySelector(".manufacturer-title")),
      label_de: labelDe,
      label_en: en(labelDe, `${nameDe} Herstellernummer`),
      origin_de: null,
      origin_en: null,
      products: readProducts(block, nameDe)
    };
  });

  // Länder ohne Hersteller tragen eine einzelne Produktkarte direkt im Artikel.
  const looseCards = [...article.querySelectorAll(":scope > .product-card")];
  if (looseCards.length) {
    producers.push({
      position: 0,
      name: null,
      label_de: null,
      label_en: null,
      origin_de: null,
      origin_en: null,
      products: readProducts(article, nameDe)
    });
  }

  const noticeDe = text(article.querySelector(".country-note p"));

  const sources = [...article.querySelectorAll(".sources a")].map((a, i) => ({
    position: i,
    title: text(a),
    url: a.getAttribute("href")
  }));

  countries.push({
    slug: slugify(nameDe),
    name_de: nameDe,
    name_en: countryNames[nameDe] ?? nameDe,
    status: "veroeffentlicht",
    // Die bisherige Reihenfolge auf der Listenseite ist die des Hinzufügens.
    sort_order: ++dokumentReihenfolge,
    spirit_de: text(article.querySelector("h2")),
    spirit_en: en(text(article.querySelector("h2")), `${nameDe} Spirituose`),
    subtitle_de: text(article.querySelector(".country-subtitle")),
    subtitle_en: en(text(article.querySelector(".country-subtitle")), `${nameDe} Untertitel`),
    notice_de: noticeDe,
    notice_en: en(noticeDe, `${nameDe} Hinweis`),
    paragraphs,
    facts,
    producers: producers.sort((a, b) => a.position - b.position),
    sources
  });
}

// ------------------------------------------------- Farbwelt aus dem CSS holen

const cssBlock = indexHtml.slice(indexHtml.indexOf("<style>"), indexHtml.indexOf("</style>"));
for (const country of countries) {
  const re = new RegExp(
    `path\\.has-content\\[data-country="${country.name_de}"\\]\\s*\\{([^}]*)\\}`,
    "s"
  );
  const block = cssBlock.match(re)?.[1] ?? "";
  const pick = (prop) => block.match(new RegExp(`--${prop}:\\s*([^;]+);`))?.[1]?.trim() ?? null;
  country.glow_rgb = pick("country-glow");
  country.stroke_hex = pick("country-stroke");
  country.fill_hex = pick("country-fill");
  country.hover_fill_hex = pick("country-hover-fill");
  country.dark_fill_hex = pick("country-dark-fill");
  country.dark_hover_hex = pick("country-dark-hover-fill");
  country.glow_delay = block.match(/animation-delay:\s*([^;]+);/)?.[1]?.trim() ?? null;
  if (!country.glow_rgb) note(`${country.name_de}: keine Farbwerte im CSS gefunden`);
}

// ------------------------------- Zusatzspalten von der Listenseite übernehmen

const listHtml = await read("public/list/index.html");
const { document: listDoc } = parseHTML(listHtml);

const byName = new Map(countries.map((c) => [c.name_de, c]));
let matchedRows = 0;
let unmatchedRows = 0;

for (const row of listDoc.querySelectorAll("tbody tr")) {
  const cells = [...row.querySelectorAll("th, td")].map((c) => text(c));
  const [land, herstellerwahl, kategorie, produkt, hersteller, herkunft, stil, zutaten, abv, einordnung] = cells;
  const country = byName.get(land);
  if (!country) { note(`Listenzeile für unbekanntes Land "${land}"`); unmatchedRows++; continue; }

  const producer =
    country.producers.find((p) => p.label_de === herstellerwahl) ??
    country.producers.find((p) => p.name === hersteller) ??
    country.producers.find((p) => p.position === 0);

  if (!producer) { note(`${land}: kein Hersteller passend zu "${herstellerwahl}" / "${hersteller}"`); unmatchedRows++; continue; }

  if (producer.name && hersteller && producer.name !== hersteller) {
    note(`${land}: Herstellername weicht ab – Detailseite "${producer.name}", Liste "${hersteller}"`);
  }
  producer.origin_de = herkunft;
  producer.origin_en = en(herkunft, `${land} Herkunft`);

  const product =
    producer.products.find((p) => p.name === produkt) ??
    producer.products.find((p) => p.tier === TIER_BY_LABEL[kategorie]);

  if (!product) { note(`${land}: kein Produkt passend zu "${produkt}"`); unmatchedRows++; continue; }
  if (product.name !== produkt) {
    note(`${land}: Produktname weicht ab – Detailseite "${product.name}", Liste "${produkt}"`);
  }

  if (kategorie !== product.tier_label_de) {
    product.tier_list_de = kategorie;
    product.tier_list_en = en(kategorie, `${land} Listenkategorie`);
  }

  product.category_de = stil;
  product.category_en = en(stil, `${land} Kategorie`);
  product.ingredients_de = zutaten;
  product.ingredients_en = en(zutaten, `${land} Zutaten`);
  product.abv_de = abv;
  product.abv_en = en(abv, `${land} Alkoholgehalt`);
  product.positioning_de = einordnung;
  product.positioning_en = en(einordnung, `${land} Einordnung`);
  matchedRows++;
}

// -------------------------------- Die übrigen Länder als leere Datensätze anlegen

for (const nameDe of [...mapCountries].sort((a, b) => a.localeCompare(b, "de"))) {
  if (byName.has(nameDe)) continue;
  const nameEn = countryNames[nameDe];
  if (!nameEn) note(`"${nameDe}" steht in asia.svg, hat aber keinen englischen Namen`);
  countries.push({
    slug: slugify(nameDe),
    name_de: nameDe,
    name_en: nameEn ?? nameDe,
    status: "leer",
    sort_order: 100,
    spirit_de: null, spirit_en: null,
    subtitle_de: null, subtitle_en: null,
    notice_de: null, notice_en: null,
    glow_rgb: null, stroke_hex: null, fill_hex: null,
    hover_fill_hex: null, dark_fill_hex: null, dark_hover_hex: null, glow_delay: null,
    paragraphs: [], facts: [], producers: [], sources: []
  });
}

countries.sort((a, b) => a.sort_order - b.sort_order || a.name_de.localeCompare(b.name_de, "de"));

// ------------------------------------------------------------------ Ausgabe

const q = (v) => (v == null ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
const sql = [
  "-- Automatisch erzeugt von scripts/extract-content.mjs – nicht von Hand ändern.",
  "-- Neu erzeugen mit: npm run extract",
  "PRAGMA foreign_keys = ON;",
  "BEGIN TRANSACTION;"
];

for (const c of countries) {
  sql.push(
    `INSERT INTO countries (slug, name_de, name_en, status, sort_order, spirit_de, spirit_en, subtitle_de, subtitle_en, notice_de, notice_en, glow_rgb, stroke_hex, fill_hex, hover_fill_hex, dark_fill_hex, dark_hover_hex, glow_delay) VALUES (${[
      c.slug, c.name_de, c.name_en, c.status, c.sort_order, c.spirit_de, c.spirit_en, c.subtitle_de, c.subtitle_en,
      c.notice_de, c.notice_en, c.glow_rgb, c.stroke_hex, c.fill_hex, c.hover_fill_hex,
      c.dark_fill_hex, c.dark_hover_hex, c.glow_delay
    ].map(q).join(", ")});`
  );
  const cid = `(SELECT id FROM countries WHERE slug = ${q(c.slug)})`;

  for (const p of c.paragraphs)
    sql.push(`INSERT INTO paragraphs (country_id, position, text_de, text_en) VALUES (${cid}, ${p.position}, ${q(p.text_de)}, ${q(p.text_en)});`);

  for (const f of c.facts)
    sql.push(`INSERT INTO facts (country_id, position, label_de, label_en, value_de, value_en) VALUES (${cid}, ${f.position}, ${q(f.label_de)}, ${q(f.label_en)}, ${q(f.value_de)}, ${q(f.value_en)});`);

  for (const pr of c.producers) {
    sql.push(`INSERT INTO producers (country_id, position, name, label_de, label_en, origin_de, origin_en) VALUES (${cid}, ${pr.position}, ${q(pr.name)}, ${q(pr.label_de)}, ${q(pr.label_en)}, ${q(pr.origin_de)}, ${q(pr.origin_en)});`);
    const prid = `(SELECT id FROM producers WHERE country_id = ${cid} AND position = ${pr.position})`;
    for (const p of pr.products)
      sql.push(
        `INSERT INTO products (producer_id, position, tier, tier_label_de, tier_label_en, tier_list_de, tier_list_en, name, meta_de, meta_en, description_de, description_en, availability_de, availability_en, category_de, category_en, ingredients_de, ingredients_en, abv_de, abv_en, positioning_de, positioning_en) VALUES (${prid}, ${p.position}, ${q(p.tier)}, ${q(p.tier_label_de)}, ${q(p.tier_label_en)}, ${q(p.tier_list_de)}, ${q(p.tier_list_en)}, ${q(p.name)}, ${q(p.meta_de)}, ${q(p.meta_en)}, ${q(p.description_de)}, ${q(p.description_en)}, ${q(p.availability_de)}, ${q(p.availability_en)}, ${q(p.category_de)}, ${q(p.category_en)}, ${q(p.ingredients_de)}, ${q(p.ingredients_en)}, ${q(p.abv_de)}, ${q(p.abv_en)}, ${q(p.positioning_de)}, ${q(p.positioning_en)});`
      );
  }

  for (const s of c.sources)
    sql.push(`INSERT INTO sources (country_id, position, title, url) VALUES (${cid}, ${s.position}, ${q(s.title)}, ${q(s.url)});`);
}

sql.push("COMMIT;");

await mkdir(new URL("content/", root), { recursive: true });
await writeFile(new URL("content/seed.json", root), JSON.stringify(countries, null, 2) + "\n");
await writeFile(new URL("migrations/0002_seed.sql", root), sql.join("\n") + "\n");

// ------------------------------------------------------------------ Bericht

const gepflegt = countries.filter((c) => c.status === "veroeffentlicht");
console.log(`Länder gesamt:            ${countries.length}`);
console.log(`davon mit Inhalt:         ${gepflegt.length} (${gepflegt.map((c) => c.name_de).join(", ")})`);
console.log(`Absätze:                  ${countries.reduce((n, c) => n + c.paragraphs.length, 0)}`);
console.log(`Faktenzeilen:             ${countries.reduce((n, c) => n + c.facts.length, 0)}`);
console.log(`Hersteller:               ${countries.reduce((n, c) => n + c.producers.length, 0)}`);
console.log(`Produkte:                 ${countries.reduce((n, c) => n + c.producers.reduce((m, p) => m + p.products.length, 0), 0)}`);
console.log(`Quellen:                  ${countries.reduce((n, c) => n + c.sources.length, 0)}`);
console.log(`Listenzeilen zugeordnet:  ${matchedRows} (nicht zugeordnet: ${unmatchedRows})`);

if (problems.length) {
  console.log(`\n${problems.length} Auffälligkeiten:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nKeine Auffälligkeiten – alle Texte haben eine englische Entsprechung.");
}
