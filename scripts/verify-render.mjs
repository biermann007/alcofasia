// Vergleicht das aus der Datenbank gerenderte HTML mit dem Stand, der vor der
// Umstellung von Hand gepflegt wurde.
//
// Verglichen wird nicht Zeichen für Zeichen – data-en-Attribute sind neu –
// sondern die inhaltliche Struktur: welche Länder, welche Absätze, welche
// Fakten, welche Hersteller, welche Produkte, welche Quellen, in welcher
// Reihenfolge. Weicht irgendetwas ab, bricht das Skript ab.
//
// Aufruf: node scripts/verify-render.mjs <pfad-zur-alten-index.html> <pfad-zur-alten-list.html>

import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { renderCountryDetails, renderListHead, renderListRows } from "../src/render.js";

const [altIndexPfad, altListPfad] = process.argv.slice(2);
if (!altIndexPfad || !altListPfad) {
  console.error("Aufruf: node scripts/verify-render.mjs <alte-index.html> <alte-list.html>");
  process.exit(2);
}

const root = new URL("../", import.meta.url);
const countries = JSON.parse(await readFile(new URL("content/seed.json", root), "utf8"));

const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);

// ----------------------------------------------------- Detailseiten vergleichen

function artikelLesen(dokument) {
  return [...dokument.querySelectorAll("[data-country-detail]")].map((article) => ({
    land: article.getAttribute("data-country-detail"),
    kicker: text(article.querySelector(".country-kicker")),
    spirituose: text(article.querySelector("h2")),
    untertitel: text(article.querySelector(".country-subtitle")),
    absaetze: [...article.querySelectorAll(".country-copy:not(.country-note) p")].map(text),
    fakten: [...article.querySelectorAll(".spirit-facts > div")].map(
      (d) => `${text(d.querySelector("dt"))} = ${text(d.querySelector("dd"))}`
    ),
    hinweis: text(article.querySelector(".country-note p")),
    hersteller: [...article.querySelectorAll(".manufacturer-block")].map((block) => ({
      beschriftung: text(block.querySelector(":scope > .product-label")),
      name: text(block.querySelector(".manufacturer-title")),
      produkte: [...block.querySelectorAll(".product-card")].map((card) => ({
        stufe: text(card.querySelector(".product-label")),
        name: text(card.querySelector(".product-name")),
        zeile: text(card.querySelector(".product-meta")),
        beschreibung: text(card.querySelector(".product-description")),
        verfuegbarkeit: text(card.querySelector(".availability"))
      }))
    })),
    loseKarten: [...article.querySelectorAll(":scope > .product-card")].map((card) => ({
      stufe: text(card.querySelector(".product-label")),
      name: text(card.querySelector(".product-name")),
      zeile: text(card.querySelector(".product-meta")),
      beschreibung: text(card.querySelector(".product-description")),
      verfuegbarkeit: text(card.querySelector(".availability"))
    })),
    quellen: [...article.querySelectorAll(".sources a")].map((a) => `${text(a)} → ${a.getAttribute("href")}`),
    zurueckKnoepfe: article.querySelectorAll("[data-detail-back]").length
  }));
}

const { document: alt } = parseHTML(await readFile(altIndexPfad, "utf8"));
const { document: neu } = parseHTML(
  `<div>${renderCountryDetails(countries)}</div>`
);

const altArtikel = artikelLesen(alt);
const neuArtikel = artikelLesen(neu);

// ------------------------------------------------------ Listenseite vergleichen

function tabelleLesen(dokument) {
  return {
    kopf: [...dokument.querySelectorAll("thead th")].map(text),
    zeilen: [...dokument.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("th, td")].map(text).join(" | ")
    )
  };
}

const { document: altListe } = parseHTML(await readFile(altListPfad, "utf8"));
const { document: neuListe } = parseHTML(
  `<table><thead>${renderListHead()}</thead><tbody>${renderListRows(countries)}</tbody></table>`
);

const altTabelle = tabelleLesen(altListe);
const neuTabelle = tabelleLesen(neuListe);

// ------------------------------------------------------------------ Vergleich

const abweichungen = [];

const vergleiche = (bezeichnung, a, b) => {
  const sa = JSON.stringify(a, null, 1);
  const sb = JSON.stringify(b, null, 1);
  if (sa === sb) return true;
  abweichungen.push({ bezeichnung, alt: sa, neu: sb });
  return false;
};

vergleiche("Reihenfolge der Länder", altArtikel.map((a) => a.land), neuArtikel.map((a) => a.land));

for (const altes of altArtikel) {
  const neues = neuArtikel.find((a) => a.land === altes.land);
  if (!neues) {
    abweichungen.push({ bezeichnung: `${altes.land} fehlt vollständig`, alt: altes.land, neu: "–" });
    continue;
  }
  for (const feld of ["kicker", "spirituose", "untertitel", "absaetze", "fakten", "hinweis", "hersteller", "loseKarten", "quellen", "zurueckKnoepfe"]) {
    vergleiche(`${altes.land} · ${feld}`, altes[feld], neues[feld]);
  }
}

vergleiche("Tabellenkopf", altTabelle.kopf, neuTabelle.kopf);
vergleiche("Anzahl Tabellenzeilen", altTabelle.zeilen.length, neuTabelle.zeilen.length);
for (const [i, zeile] of altTabelle.zeilen.entries()) {
  vergleiche(`Tabellenzeile ${i + 1}`, zeile, neuTabelle.zeilen[i]);
}

// --------------------------------------------------------------- Zweisprachigkeit

const { document: neuMitAttr } = parseHTML(`<div>${renderCountryDetails(countries)}</div>`);
const ohneEnglisch = [];
for (const el of neuMitAttr.querySelectorAll(".country-copy p, .spirit-facts dt, .spirit-facts dd, .product-meta, .product-description, .availability, .country-subtitle")) {
  const de = text(el);
  const en = el.getAttribute("data-en");
  // Kein data-en heißt: in beiden Sprachen gleich. Bei erkennbar deutschem Text
  // wäre das eine Lücke.
  if (!en && /[äöüßÄÖÜ]|\b(und|oder|mit|nicht|kein|keine|derzeit|erhältlich)\b/.test(de)) {
    ohneEnglisch.push(de.slice(0, 70));
  }
}

// ------------------------------------------------------------------- Ergebnis

console.log(`Länder mit Detailseite:  ${neuArtikel.length}`);
console.log(`Verglichene Felder:      ${altArtikel.length * 10 + altTabelle.zeilen.length + 3}`);
console.log(`Tabellenzeilen:          ${neuTabelle.zeilen.length}`);
console.log(`Texte ohne data-en:      ${ohneEnglisch.length}`);

if (ohneEnglisch.length) {
  console.log("\nDeutsche Texte ohne englische Fassung:");
  for (const t of ohneEnglisch) console.log(`  - ${t}`);
}

if (abweichungen.length) {
  console.log(`\n${abweichungen.length} Abweichungen zum alten Stand:\n`);
  for (const a of abweichungen.slice(0, 12)) {
    console.log(`── ${a.bezeichnung}`);
    console.log(`   vorher: ${a.alt.slice(0, 400)}`);
    console.log(`   jetzt:  ${a.neu.slice(0, 400)}\n`);
  }
  if (abweichungen.length > 12) console.log(`… und ${abweichungen.length - 12} weitere`);
  process.exit(1);
}

console.log("\nDie gerenderten Seiten entsprechen inhaltlich exakt dem alten Stand.");
