// Einmalige Umstellung: entfernt die von Hand gepflegten Länderinhalte aus den
// statischen Seiten und setzt Platzhalter, die der Worker zur Laufzeit füllt.
//
// Layout, CSS und Bedienelemente bleiben unangetastet – nur die Inhalte ziehen
// in die Datenbank um.

import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pfad = (p) => new URL(p, root);

// ------------------------------------------------------------- index.html

let index = await readFile(pfad("public/index.html"), "utf8");

// 1. Die fünf Detailartikel durch einen Platzhalter ersetzen
const ersterArtikel = index.indexOf('        <article class="country-detail"');
const letzterArtikelEnde = index.lastIndexOf("        </article>");
if (ersterArtikel === -1 || letzterArtikelEnde === -1) {
  throw new Error("Detailartikel in index.html nicht gefunden – wurde das Skript schon ausgeführt?");
}
const artikelAnzahl = (index.match(/<article class="country-detail"/g) ?? []).length;
index =
  index.slice(0, ersterArtikel) +
  '        <div data-country-details></div>\n' +
  index.slice(letzterArtikelEnde + "        </article>\n".length);

// 2. Die länderspezifischen Farbregeln durch einen Platzhalter ersetzen
const farbRegel = /\n      \.asia-map path\.has-content\[data-country="[^"]+"\] \{[^}]*\}\n/g;
const farbTreffer = index.match(farbRegel) ?? [];
index = index.replace(farbRegel, "");

const ankerFarben = "      .asia-map path.has-content:hover,";
index = index.replace(
  ankerFarben,
  `      /* Länderfarben werden vom Worker aus der Datenbank eingesetzt */\n\n${ankerFarben}`
);
index = index.replace(
  "    <style>",
  '    <style data-country-colors></style>\n    <style>'
);

// 3. Statische Beschriftungen bekommen ihre englische Fassung als Attribut
index = index.replace(
  '<button class="view-toggle" type="button" data-view-toggle',
  '<button class="view-toggle" type="button" data-en="Show countries" data-view-toggle'
);
index = index.replace(
  '<nav class="site-controls" aria-label="Sprache und Darstellung">',
  '<nav class="site-controls" aria-label="Sprache und Darstellung" data-en-label="Language and appearance">'
);

// 4. Ländernamen für die Karte werden vom Worker eingesetzt
index = index.replace(
  '    <script src="/site-ui.js"></script>',
  '    <script data-country-names></script>\n    <script src="/site-ui.js"></script>'
);

await writeFile(pfad("public/index.html"), index);

// -------------------------------------------------------- list/index.html

let liste = await readFile(pfad("public/list/index.html"), "utf8");

const kopfStart = liste.indexOf("          <thead>");
const kopfEnde = liste.indexOf("</thead>", kopfStart);
const koerperStart = liste.indexOf("          <tbody>");
const koerperEnde = liste.indexOf("</tbody>", koerperStart);
if (kopfStart === -1 || koerperStart === -1) throw new Error("Tabelle in list/index.html nicht gefunden");

const zeilenAnzahl = (liste.slice(koerperStart, koerperEnde).match(/<tr>/g) ?? []).length;

liste =
  liste.slice(0, koerperStart) +
  "          <tbody data-list-rows></tbody>\n        " +
  liste.slice(koerperEnde + "</tbody>\n        ".length);

const kopfStart2 = liste.indexOf("          <thead>");
const kopfEnde2 = liste.indexOf("</thead>", kopfStart2);
liste =
  liste.slice(0, kopfStart2) +
  "          <thead data-list-head></thead>\n        " +
  liste.slice(kopfEnde2 + "</thead>\n        ".length);

liste = liste.replace(
  '<nav class="site-controls" aria-label="Sprache und Darstellung">',
  '<nav class="site-controls" aria-label="Sprache und Darstellung" data-en-label="Language and appearance">'
);
liste = liste.replace(
  '    <script src="/site-ui.js"></script>',
  '    <script data-country-names></script>\n    <script src="/site-ui.js"></script>'
);

await writeFile(pfad("public/list/index.html"), liste);

console.log(`index.html:      ${artikelAnzahl} Detailartikel und ${farbTreffer.length} Farbregeln entfernt`);
console.log(`list/index.html: Tabellenkopf und ${zeilenAnzahl} Produktzeilen entfernt`);
console.log("Platzhalter gesetzt: data-country-details, data-country-colors, data-country-names, data-list-head, data-list-rows");
