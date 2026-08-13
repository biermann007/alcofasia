// Adminbereich unter /admin.
//
// Serverseitig wird nur das Gerüst gebaut, die wiederholbaren Blöcke
// (Absätze, Fakten, Hersteller, Produkte, Quellen) baut die Seite selbst auf.
// Das hält den Code klein und kommt ohne Bauschritt aus.

import { angemeldeterBenutzer } from "./access.js";
import { loadCountries, loadCountry, saveCountry, protokolliereRecherche, loadBuddhaTexte, saveBuddhaTexte } from "./db.js";
import { landRecherchieren, felderUebersetzen } from "./research.js";
import { cacheLeeren } from "./cache.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const json = (daten, status = 200) =>
  new Response(JSON.stringify(daten), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

const html = (inhalt, status = 200) =>
  new Response(inhalt, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "same-origin",
      "content-security-policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'"
    }
  });

const STIL = `
  :root { color-scheme: light dark; --rahmen: #d8d8d8; --gedaempft: #6b6b6b; --flaeche: #fafafa; }
  * { box-sizing: border-box; }
  body { max-width: 74rem; margin: 0 auto; padding: 2rem 1.25rem 6rem;
         font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  a { color: inherit; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.05rem; margin: 2.25rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--rahmen); }
  h3 { font-size: 0.9rem; margin: 0 0 0.5rem; }
  p.hinweis { color: var(--gedaempft); margin: 0 0 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.5rem 0.6rem; text-align: left; border-bottom: 1px solid var(--rahmen); }
  th { font-weight: 600; color: var(--gedaempft); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .status { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; border: 1px solid var(--rahmen); }
  .status-veroeffentlicht { border-color: #4a7c59; color: #4a7c59; }
  .status-entwurf { border-color: #a8791f; color: #a8791f; }
  .status-leer { color: var(--gedaempft); }
  .paar { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 0.75rem; margin-bottom: 0.6rem; }
  .paar > label { display: block; font-size: 0.75rem; color: var(--gedaempft); }
  input, textarea, select { width: 100%; padding: 0.45rem 0.55rem; border: 1px solid var(--rahmen);
                            border-radius: 4px; font: inherit; background: canvas; color: inherit; }
  textarea { min-height: 4.5rem; resize: vertical; }
  fieldset { border: 1px solid var(--rahmen); border-radius: 6px; padding: 0.9rem 1rem; margin: 0 0 1rem; }
  legend { font-size: 0.8rem; color: var(--gedaempft); padding: 0 0.35rem; }
  button { padding: 0.45rem 0.9rem; border: 1px solid currentColor; border-radius: 4px;
           background: transparent; color: inherit; font: inherit; cursor: pointer; }
  button.haupt { background: #111; color: #fff; border-color: #111; }
  button.klein { padding: 0.2rem 0.5rem; font-size: 0.8rem; color: var(--gedaempft); }
  .zeile { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .leiste { position: sticky; bottom: 0; display: flex; gap: 0.75rem; align-items: center;
            padding: 0.9rem 0; margin-top: 2rem; border-top: 1px solid var(--rahmen); background: canvas; }
  .block { border: 1px solid var(--rahmen); border-radius: 6px; padding: 1rem; margin-bottom: 1rem; background: var(--flaeche); }
  .meldung { padding: 0.7rem 0.9rem; border: 1px solid var(--rahmen); border-radius: 4px; margin-bottom: 1rem; }
  .meldung.fehler { border-color: #b3261e; color: #b3261e; }
  .meldung.erfolg { border-color: #4a7c59; color: #4a7c59; }
  .vorschlag { border: 1px solid #4a7c59; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; }
  .vorschlag td { vertical-align: top; font-size: 0.85rem; }
  .verborgen { display: none; }
  @media (prefers-color-scheme: dark) { :root { --rahmen: #333; --gedaempft: #999; --flaeche: #141414; }
    button.haupt { background: #eee; color: #111; border-color: #eee; } }
  @media (max-width: 40rem) { .paar { grid-template-columns: 1fr; } }
`;

const seite = (titel, inhalt) => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(titel)} · alcofasia Admin</title>
    <style>${STIL}</style>
  </head>
  <body>${inhalt}</body>
</html>`;

// ------------------------------------------------------------------ Übersicht

function uebersichtSeite(countries, benutzer) {
  const zeilen = countries
    .map((c) => {
      const produkte = c.producers.reduce((n, p) => n + p.products.length, 0);
      return `
        <tr>
          <td><a href="/admin/land/${escapeHtml(c.slug)}">${escapeHtml(c.name_de)}</a></td>
          <td>${escapeHtml(c.name_en)}</td>
          <td><span class="status status-${escapeHtml(c.status)}">${escapeHtml(c.status)}</span>${
            c.alkoholverbot ? ' <span class="status" style="border-color:#b3261e;color:#b3261e">Verbot</span>' : ""
          }</td>
          <td>${escapeHtml(c.spirit_de ?? "–")}</td>
          <td>${c.producers.length || "–"}</td>
          <td>${produkte || "–"}</td>
          <td>${c.sources.length || "–"}</td>
          <td>${escapeHtml((c.updated_at ?? "").slice(0, 10) || "–")}</td>
        </tr>`;
    })
    .join("");

  const gepflegt = countries.filter((c) => c.status === "veroeffentlicht").length;
  const entwuerfe = countries.filter((c) => c.status === "entwurf").length;

  return seite(
    "Übersicht",
    `
    <h1>alcofasia · Redaktion</h1>
    <p class="hinweis">
      Angemeldet als ${escapeHtml(benutzer)} ·
      ${countries.length} Länder, davon ${gepflegt} veröffentlicht und ${entwuerfe} im Entwurf ·
      <a href="/">Zur Seite</a> ·
      <a href="/admin/buddha">Buddha-Seite</a>
    </p>
    <table>
      <thead>
        <tr>
          <th>Land</th><th>Englisch</th><th>Status</th><th>Spirituose</th>
          <th>Hersteller</th><th>Produkte</th><th>Quellen</th><th>Geändert</th>
        </tr>
      </thead>
      <tbody>${zeilen}</tbody>
    </table>`
  );
}

// ------------------------------------------------------------- Buddha-Seite
//
// Zwei Textbereiche der Seite /buddha: "Top 3" und "Empfehlung", jeweils
// deutsch und englisch. Leerzeilen in der Eingabe trennen Absätze.

const BUDDHA_SKRIPT = String.raw`
const formular = document.getElementById("formular");
const statusText = document.getElementById("status-text");
const meldungen = document.getElementById("meldungen");

const melden = (text, art = "erfolg") => {
  meldungen.innerHTML = '<div class="meldung ' + art + '">' + text + "</div>";
  meldungen.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

formular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  statusText.textContent = "Speichert \u2026";
  try {
    const antwort = await fetch("/admin/api/buddha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        top3: { text_de: formular.elements.top3_de.value, text_en: formular.elements.top3_en.value },
        empfehlung: { text_de: formular.elements.empfehlung_de.value, text_en: formular.elements.empfehlung_en.value }
      })
    });
    const ergebnis = await antwort.json().catch(() => ({ fehler: "Antwort war kein JSON" }));
    if (!antwort.ok) throw new Error(ergebnis.fehler ?? ("Fehler " + antwort.status));
    statusText.textContent = "";
    melden("Gespeichert. Die Seite zeigt die \u00c4nderung innerhalb einer halben Minute.");
  } catch (fehler) {
    statusText.textContent = "";
    melden("Speichern fehlgeschlagen: " + fehler.message, "fehler");
  }
});
`;

function buddhaSeite(texte, benutzer) {
  const wert = (key, feld) => escapeHtml(texte[key]?.[feld] ?? "");
  return seite(
    "Buddha-Seite",
    `
    <p class="hinweis"><a href="/admin">← Alle Länder</a> · angemeldet als ${escapeHtml(benutzer)}</p>
    <h1>Buddha-Seite</h1>
    <p class="hinweis">
      Die beiden Textbereiche der Seite <a href="/buddha">/buddha</a>.
      Leerzeilen trennen Absätze, einfache Zeilenumbrüche bleiben erhalten,
      und eine Zeile, die mit <code>##&nbsp;</code> beginnt, wird zur
      Zwischenüberschrift. HTML wird nicht interpretiert.
      Links steht Deutsch, rechts Englisch.
    </p>

    <div id="meldungen"></div>

    <form id="formular">
      <h2>Top 3</h2>
      <fieldset>
        <legend>Erscheint rechts oben auf der Seite</legend>
        <div class="paar">
          <label>Text (deutsch)<textarea name="top3_de" style="min-height:10rem">${wert("top3", "text_de")}</textarea></label>
          <label>Text (englisch)<textarea name="top3_en" style="min-height:10rem">${wert("top3", "text_en")}</textarea></label>
        </div>
      </fieldset>

      <h2>Empfehlung</h2>
      <fieldset>
        <legend>Erscheint auf der Seite unter den Top 3</legend>
        <div class="paar">
          <label>Text (deutsch)<textarea name="empfehlung_de" style="min-height:10rem">${wert("empfehlung", "text_de")}</textarea></label>
          <label>Text (englisch)<textarea name="empfehlung_en" style="min-height:10rem">${wert("empfehlung", "text_en")}</textarea></label>
        </div>
      </fieldset>

      <div class="leiste">
        <button type="submit" class="haupt">Speichern</button>
        <span id="status-text" style="color:var(--gedaempft)"></span>
      </div>
    </form>

    <script>${BUDDHA_SKRIPT}</script>`
  );
}

// ------------------------------------------------------------ Bearbeitungsseite

function bearbeitenSeite(country, benutzer) {
  return seite(
    country.name_de,
    `
    <p class="hinweis"><a href="/admin">← Alle Länder</a> · angemeldet als ${escapeHtml(benutzer)}</p>
    <h1>${escapeHtml(country.name_de)} <span style="color:var(--gedaempft);font-weight:400">· ${escapeHtml(country.name_en)}</span></h1>
    <p class="hinweis">
      Der Ländername ist fest, weil er zur Karte passen muss.
      Links steht immer Deutsch, rechts Englisch.
    </p>

    <div id="meldungen"></div>
    <div id="vorschlagsbereich"></div>

    <form id="formular">
      <h2>Kopf</h2>
      <fieldset>
        <legend>Status</legend>
        <select name="status" id="status">
          <option value="leer">leer – wird auf der Karte nicht hervorgehoben</option>
          <option value="entwurf">Entwurf – nur hier sichtbar</option>
          <option value="veroeffentlicht">veröffentlicht – auf der Seite sichtbar</option>
        </select>
      </fieldset>

      <fieldset>
        <legend>Alkoholverbot</legend>
        <label style="display:flex;gap:0.5rem;align-items:flex-start">
          <input type="checkbox" name="alkoholverbot" style="width:auto;margin-top:0.25rem">
          <span>Im Land ist Alkohol verboten. Das Land erscheint dann im Laufband
          über der Karte rot statt leuchtend.</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Spirituose und Untertitel</legend>
        <div class="paar">
          <label>Spirituose (deutsch)<input name="spirit_de"></label>
          <label>Spirit (englisch)<input name="spirit_en"></label>
          <label>Untertitel (deutsch)<input name="subtitle_de"></label>
          <label>Subtitle (englisch)<input name="subtitle_en"></label>
        </div>
      </fieldset>

      <h2>Fließtext</h2>
      <div id="absaetze"></div>
      <button type="button" class="klein" data-hinzufuegen="absatz">+ Absatz</button>

      <h2>Faktenliste</h2>
      <div id="fakten"></div>
      <button type="button" class="klein" data-hinzufuegen="fakt">+ Zeile</button>

      <h2>Hersteller und Produkte</h2>
      <div id="hersteller"></div>
      <button type="button" class="klein" data-hinzufuegen="hersteller">+ Hersteller</button>

      <h2>Rechtlicher Hinweis</h2>
      <fieldset>
        <legend>Erscheint als Kasten unter den Produkten, etwa bei Einfuhrverboten</legend>
        <div class="paar">
          <label>Hinweis (deutsch)<textarea name="notice_de"></textarea></label>
          <label>Notice (englisch)<textarea name="notice_en"></textarea></label>
        </div>
      </fieldset>

      <h2>Quellen</h2>
      <div id="quellen"></div>
      <button type="button" class="klein" data-hinzufuegen="quelle">+ Quelle</button>

      <h2>Farbe auf der Karte</h2>
      <fieldset>
        <legend>Wird nur bei veröffentlichten Ländern verwendet</legend>
        <div class="paar">
          <label>Leuchten (R G B)<input name="glow_rgb" placeholder="95 143 140"></label>
          <label>Kontur<input name="stroke_hex" placeholder="#5b8582"></label>
          <label>Fläche hell<input name="fill_hex" placeholder="#eaf2f1"></label>
          <label>Fläche hell, überfahren<input name="hover_fill_hex" placeholder="#d3e4e2"></label>
          <label>Fläche dunkel<input name="dark_fill_hex" placeholder="#14201f"></label>
          <label>Fläche dunkel, überfahren<input name="dark_hover_hex" placeholder="#1d302e"></label>
        </div>
      </fieldset>

      <div class="leiste">
        <button type="submit" class="haupt">Speichern</button>
        <button type="button" id="recherchieren">Recherchieren</button>
        <button type="button" id="uebersetzen">Englisch ergänzen</button>
        <span id="status-text" style="color:var(--gedaempft)"></span>
      </div>
    </form>

    <script id="daten" type="application/json">${JSON.stringify(country).replaceAll("<", "\\u003c")}</script>
    <script>${ADMIN_SKRIPT}</script>`
  );
}

const ADMIN_SKRIPT = String.raw`
const land = JSON.parse(document.getElementById("daten").textContent);
const formular = document.getElementById("formular");
const statusText = document.getElementById("status-text");
const meldungen = document.getElementById("meldungen");

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const melden = (text, art = "erfolg") => {
  meldungen.innerHTML = '<div class="meldung ' + art + '">' + text + "</div>";
  meldungen.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

const entfernenKnopf = () =>
  '<button type="button" class="klein" onclick="this.closest(\'[data-block]\').remove()">Entfernen</button>';

// ---------------------------------------------------------------- Bausteine

const absatzBlock = (p = {}) =>
  el('<div class="block" data-block="absatz">' +
     '<div class="paar">' +
     '<label>Absatz (deutsch)<textarea data-feld="text_de">' + (p.text_de ?? "") + "</textarea></label>" +
     '<label>Paragraph (englisch)<textarea data-feld="text_en">' + (p.text_en ?? "") + "</textarea></label>" +
     "</div>" + entfernenKnopf() + "</div>");

const faktBlock = (f = {}) =>
  el('<div class="block" data-block="fakt">' +
     '<div class="paar">' +
     '<label>Bezeichnung (deutsch)<input data-feld="label_de" value="' + (f.label_de ?? "").replaceAll('"', "&quot;") + '"></label>' +
     '<label>Label (englisch)<input data-feld="label_en" value="' + (f.label_en ?? "").replaceAll('"', "&quot;") + '"></label>' +
     '<label>Wert (deutsch)<input data-feld="value_de" value="' + (f.value_de ?? "").replaceAll('"', "&quot;") + '"></label>' +
     '<label>Value (englisch)<input data-feld="value_en" value="' + (f.value_en ?? "").replaceAll('"', "&quot;") + '"></label>' +
     "</div>" + entfernenKnopf() + "</div>");

const quelleBlock = (s = {}) =>
  el('<div class="block" data-block="quelle">' +
     '<div class="paar">' +
     '<label>Titel<input data-feld="title" value="' + (s.title ?? "").replaceAll('"', "&quot;") + '"></label>' +
     '<label>Adresse<input data-feld="url" type="url" value="' + (s.url ?? "").replaceAll('"', "&quot;") + '"></label>' +
     "</div>" + entfernenKnopf() + "</div>");

const STUFEN = [["low", "Low"], ["standard", "Standard"], ["premium", "Premium"], ["keine", "Keine Kategorie"]];

const produktBlock = (p = {}) => {
  const v = (k) => (p[k] ?? "").replaceAll('"', "&quot;");
  const optionen = STUFEN.map(([w, l]) =>
    '<option value="' + w + '"' + (p.tier === w ? " selected" : "") + ">" + l + "</option>").join("");
  return el('<fieldset data-block="produkt">' +
    "<legend>Produkt</legend>" +
    '<div class="paar">' +
    '<label>Stufe<select data-feld="tier">' + optionen + "</select></label>" +
    '<label>Beschriftung der Stufe (deutsch)<input data-feld="tier_label_de" value="' + v("tier_label_de") + '"></label>' +
    '<label>Produktname<input data-feld="name" value="' + v("name") + '"></label>' +
    '<label>Beschriftung der Stufe (englisch)<input data-feld="tier_label_en" value="' + v("tier_label_en") + '"></label>' +
    '<label>Produktzeile (deutsch)<input data-feld="meta_de" value="' + v("meta_de") + '"></label>' +
    '<label>Product line (englisch)<input data-feld="meta_en" value="' + v("meta_en") + '"></label>' +
    '<label>Beschreibung (deutsch)<textarea data-feld="description_de">' + (p.description_de ?? "") + "</textarea></label>" +
    '<label>Description (englisch)<textarea data-feld="description_en">' + (p.description_en ?? "") + "</textarea></label>" +
    '<label>Verfügbarkeit (deutsch)<input data-feld="availability_de" value="' + v("availability_de") + '"></label>' +
    '<label>Availability (englisch)<input data-feld="availability_en" value="' + v("availability_en") + '"></label>' +
    '<label>Stil (deutsch, für die Liste)<input data-feld="category_de" value="' + v("category_de") + '"></label>' +
    '<label>Style (englisch)<input data-feld="category_en" value="' + v("category_en") + '"></label>' +
    '<label>Zutaten (deutsch)<input data-feld="ingredients_de" value="' + v("ingredients_de") + '"></label>' +
    '<label>Ingredients (englisch)<input data-feld="ingredients_en" value="' + v("ingredients_en") + '"></label>' +
    '<label>Alkoholgehalt (deutsch)<input data-feld="abv_de" value="' + v("abv_de") + '" placeholder="40 % Vol."></label>' +
    '<label>Alcohol content (englisch)<input data-feld="abv_en" value="' + v("abv_en") + '" placeholder="40% ABV"></label>' +
    '<label>Einordnung (deutsch)<input data-feld="positioning_de" value="' + v("positioning_de") + '"></label>' +
    '<label>Positioning (englisch)<input data-feld="positioning_en" value="' + v("positioning_en") + '"></label>' +
    "</div>" + entfernenKnopf() + "</fieldset>");
};

const herstellerBlock = (h = {}) => {
  const v = (k) => (h[k] ?? "").replaceAll('"', "&quot;");
  const block = el('<div class="block" data-block="hersteller">' +
    '<div class="paar">' +
    '<label>Firmenname<input data-feld="name" value="' + v("name") + '"></label>' +
    '<label>Beschriftung (deutsch), z. B. 1. Hersteller<input data-feld="label_de" value="' + v("label_de") + '"></label>' +
    '<label>Herkunft (deutsch)<input data-feld="origin_de" value="' + v("origin_de") + '"></label>' +
    '<label>Beschriftung (englisch)<input data-feld="label_en" value="' + v("label_en") + '"></label>' +
    '<label>Origin (englisch)<input data-feld="origin_en" value="' + v("origin_en") + '"></label>' +
    "</div>" +
    '<div data-produkte></div>' +
    '<div class="zeile"><button type="button" class="klein" data-produkt-hinzufuegen>+ Produkt</button>' + entfernenKnopf() + "</div>" +
    "</div>");

  const ziel = block.querySelector("[data-produkte]");
  for (const p of h.products ?? []) ziel.append(produktBlock(p));
  block.querySelector("[data-produkt-hinzufuegen]").addEventListener("click", () => ziel.append(produktBlock()));
  return block;
};

// ------------------------------------------------------------- Formular füllen

const bereiche = {
  absaetze: document.getElementById("absaetze"),
  fakten: document.getElementById("fakten"),
  hersteller: document.getElementById("hersteller"),
  quellen: document.getElementById("quellen")
};

// Nur echte Listen durchlaufen. Ein String ist ebenfalls iterierbar – Zeichen
// für Zeichen. Als die Recherche die Absätze einmal als einen String lieferte,
// entstanden daraus tausende leere Absatzblöcke im Formular.
const listeErzwingen = (wert) => (Array.isArray(wert) ? wert : []);

function formularFuellen(daten) {
  for (const feld of ["status", "spirit_de", "spirit_en", "subtitle_de", "subtitle_en",
                      "notice_de", "notice_en", "glow_rgb", "stroke_hex", "fill_hex",
                      "hover_fill_hex", "dark_fill_hex", "dark_hover_hex"]) {
    const eingabe = formular.elements[feld];
    if (eingabe) eingabe.value = daten[feld] ?? "";
  }
  formular.elements.alkoholverbot.checked = Boolean(Number(daten.alkoholverbot ?? 0));
  for (const k of Object.keys(bereiche)) bereiche[k].replaceChildren();
  for (const p of listeErzwingen(daten.paragraphs)) bereiche.absaetze.append(absatzBlock(p));
  for (const f of listeErzwingen(daten.facts)) bereiche.fakten.append(faktBlock(f));
  for (const h of listeErzwingen(daten.producers)) bereiche.hersteller.append(herstellerBlock(h));
  for (const s of listeErzwingen(daten.sources)) bereiche.quellen.append(quelleBlock(s));
}

formularFuellen(land);

document.querySelectorAll("[data-hinzufuegen]").forEach((knopf) => {
  knopf.addEventListener("click", () => {
    const art = knopf.dataset.hinzufuegen;
    if (art === "absatz") bereiche.absaetze.append(absatzBlock());
    if (art === "fakt") bereiche.fakten.append(faktBlock());
    if (art === "hersteller") bereiche.hersteller.append(herstellerBlock());
    if (art === "quelle") bereiche.quellen.append(quelleBlock());
  });
});

// ------------------------------------------------------------- Formular lesen

const blockLesen = (block) => {
  const werte = {};
  for (const feld of block.querySelectorAll("[data-feld]")) {
    if (feld.closest("[data-block]") !== block) continue;
    werte[feld.dataset.feld] = feld.value.trim();
  }
  return werte;
};

function formularLesen() {
  const daten = {};
  for (const feld of ["status", "spirit_de", "spirit_en", "subtitle_de", "subtitle_en",
                      "notice_de", "notice_en", "glow_rgb", "stroke_hex", "fill_hex",
                      "hover_fill_hex", "dark_fill_hex", "dark_hover_hex"]) {
    const eingabe = formular.elements[feld];
    if (eingabe) daten[feld] = eingabe.value.trim() || null;
  }
  daten.alkoholverbot = formular.elements.alkoholverbot.checked ? 1 : 0;
  daten.paragraphs = [...bereiche.absaetze.children].map(blockLesen);
  daten.facts = [...bereiche.fakten.children].map(blockLesen);
  daten.sources = [...bereiche.quellen.children].map(blockLesen);
  daten.producers = [...bereiche.hersteller.children].map((block, i) => ({
    ...blockLesen(block),
    position: i + 1,
    products: [...block.querySelectorAll('[data-block="produkt"]')].map(blockLesen)
  }));
  return daten;
}

// ------------------------------------------------------------------ Aktionen

async function ruf(pfad, koerper) {
  const antwort = await fetch(pfad, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper ?? {})
  });
  const ergebnis = await antwort.json().catch(() => ({ fehler: "Antwort war kein JSON" }));
  if (!antwort.ok) throw new Error(ergebnis.fehler ?? ("Fehler " + antwort.status));
  return ergebnis;
}

formular.addEventListener("submit", async (ereignis) => {
  ereignis.preventDefault();
  statusText.textContent = "Speichert …";
  try {
    await ruf("/admin/api/land/" + land.slug, formularLesen());
    statusText.textContent = "";
    melden("Gespeichert. Die Seite zeigt die Änderung innerhalb einer halben Minute.");
  } catch (fehler) {
    statusText.textContent = "";
    melden("Speichern fehlgeschlagen: " + fehler.message, "fehler");
  }
});

document.getElementById("uebersetzen").addEventListener("click", async () => {
  statusText.textContent = "Übersetzt …";
  try {
    const { daten } = await ruf("/admin/api/uebersetzen/" + land.slug, formularLesen());
    formularFuellen(daten);
    statusText.textContent = "";
    melden("Englische Felder ergänzt. Bitte prüfen und dann speichern – gespeichert ist noch nichts.");
  } catch (fehler) {
    statusText.textContent = "";
    melden("Übersetzen fehlgeschlagen: " + fehler.message, "fehler");
  }
});

// ------------------------------------------------------------------ Recherche

const bereichVorschlag = document.getElementById("vorschlagsbereich");

document.getElementById("recherchieren").addEventListener("click", async () => {
  // Die Recherche braucht je nach Land einige Minuten: bis zu zwölf Websuchen
  // plus das Schreiben des ganzen Datensatzes. Die mitlaufende Uhr zeigt,
  // dass nichts hängt.
  const start = Date.now();
  const anzeige = () => {
    const s = Math.round((Date.now() - start) / 1000);
    const zeit = s < 60 ? s + " s" : Math.floor(s / 60) + " min " + (s % 60) + " s";
    statusText.textContent = "Recherchiert seit " + zeit + " – das kann einige Minuten dauern …";
  };
  anzeige();
  const uhr = setInterval(anzeige, 1000);
  bereichVorschlag.replaceChildren();
  try {
    const ergebnis = await ruf("/admin/api/recherche/" + land.slug);
    vorschlagAnzeigen(ergebnis);
  } catch (fehler) {
    melden("Recherche fehlgeschlagen: " + fehler.message, "fehler");
  } finally {
    clearInterval(uhr);
    statusText.textContent = "";
  }
});

function vorschlagAnzeigen({ vorschlag, besuchteQuellen, modell }) {
  const aktuell = formularLesen();
  const kurz = (wert) => {
    if (wert == null || wert === "") return "<em style='color:var(--gedaempft)'>leer</em>";
    const text = typeof wert === "string" ? wert : JSON.stringify(wert);
    return text.length > 220 ? text.slice(0, 220) + " …" : text;
  };

  const zeilen = [
    ["Spirituose", aktuell.spirit_de, vorschlag.spirit_de],
    ["Untertitel", aktuell.subtitle_de, vorschlag.subtitle_de],
    ["Absätze", aktuell.paragraphs.length + " Stück", (vorschlag.paragraphs ?? []).length + " Stück"],
    ["Faktenzeilen", aktuell.facts.length + " Stück", (vorschlag.facts ?? []).length + " Stück"],
    ["Hersteller", aktuell.producers.map((p) => p.name).filter(Boolean).join(", ") || null,
      (vorschlag.producers ?? []).map((p) => p.name).join(", ")],
    ["Produkte", aktuell.producers.reduce((n, p) => n + p.products.length, 0) + " Stück",
      (vorschlag.producers ?? []).reduce((n, p) => n + (p.products ?? []).length, 0) + " Stück"],
    ["Rechtlicher Hinweis", aktuell.notice_de, vorschlag.notice_de],
    ["Quellen", aktuell.sources.length + " Stück", (vorschlag.sources ?? []).length + " Stück"]
  ]
    .map(([name, alt, neu]) => "<tr><th>" + name + "</th><td>" + kurz(alt) + "</td><td>" + kurz(neu) + "</td></tr>")
    .join("");

  const unsicher = (vorschlag.unsicherheiten ?? []).length
    ? "<p><strong>Nicht sicher belegt:</strong></p><ul><li>" +
      vorschlag.unsicherheiten.map((u) => u.replaceAll("<", "&lt;")).join("</li><li>") + "</li></ul>"
    : "";

  const quellenListe = (vorschlag.sources ?? [])
    .map((s) => '<li><a href="' + s.url.replaceAll('"', "&quot;") + '" target="_blank" rel="noopener noreferrer">' +
                s.title.replaceAll("<", "&lt;") + "</a></li>").join("");

  const kasten = el(
    '<div class="vorschlag">' +
    "<h3>Vorschlag aus der Recherche" + (modell ? " · " + modell : "") + "</h3>" +
    "<p style='color:var(--gedaempft)'>Nichts davon ist gespeichert. Übernehmen füllt nur das Formular; " +
    "gespeichert wird erst, wenn du danach auf Speichern klickst.</p>" +
    "<table><thead><tr><th>Feld</th><th>Aktuell</th><th>Vorschlag</th></tr></thead><tbody>" + zeilen + "</tbody></table>" +
    unsicher +
    (quellenListe ? "<p><strong>Vorgeschlagene Quellen:</strong></p><ul>" + quellenListe + "</ul>" : "") +
    (besuchteQuellen?.length ? "<p style='color:var(--gedaempft);font-size:0.8rem'>Besuchte Seiten: " +
      besuchteQuellen.length + "</p>" : "") +
    '<div class="zeile"><button type="button" data-uebernehmen class="haupt">Vorschlag ins Formular übernehmen</button>' +
    '<button type="button" data-verwerfen>Verwerfen</button></div>' +
    "</div>"
  );

  kasten.querySelector("[data-uebernehmen]").addEventListener("click", () => {
    formularFuellen(vorschlagInFormular(vorschlag, aktuell));
    kasten.remove();
    melden("Übernommen. Die englischen Felder füllt danach der Knopf \u201EEnglisch ergänzen\u201C. Bitte prüfen und dann speichern.");
  });
  kasten.querySelector("[data-verwerfen]").addEventListener("click", () => kasten.remove());

  bereichVorschlag.append(kasten);
  kasten.scrollIntoView({ behavior: "smooth", block: "start" });
}

function vorschlagInFormular(vorschlag, aktuell) {
  return {
    ...aktuell,
    status: aktuell.status === "leer" ? "entwurf" : aktuell.status,
    spirit_de: vorschlag.spirit_de ?? aktuell.spirit_de,
    spirit_en: vorschlag.spirit_en ?? aktuell.spirit_en,
    subtitle_de: vorschlag.subtitle_de ?? aktuell.subtitle_de,
    subtitle_en: vorschlag.subtitle_en ?? aktuell.subtitle_en,
    notice_de: vorschlag.notice_de ?? aktuell.notice_de,
    notice_en: vorschlag.notice_en ?? aktuell.notice_en,
    paragraphs: vorschlag.paragraphs ?? aktuell.paragraphs,
    facts: vorschlag.facts ?? aktuell.facts,
    sources: vorschlag.sources ?? aktuell.sources,
    producers: (vorschlag.producers ?? []).map((p, i) => ({
      name: p.name,
      label_de: p.label_de ?? (i + 1) + ". Hersteller",
      label_en: p.label_en ?? ["1st", "2nd", "3rd"][i] + " producer",
      origin_de: p.origin_de,
      origin_en: p.origin_en,
      products: (p.products ?? []).map((x) => ({
        ...x,
        tier_label_de: x.tier_label_de ?? { low: "Low", standard: "Standard", premium: "Premium" }[x.tier],
        tier_label_en: x.tier_label_en ?? { low: "Low", standard: "Standard", premium: "Premium" }[x.tier],
        availability_de: x.availability_de ?? "Demnächst erhältlich",
        availability_en: x.availability_en ?? "Coming soon"
      }))
    }))
  };
}
`;

// ---------------------------------------------------------------- Wegweiser

/**
 * @param optionen.pruefeAnmeldung – nur für den lokalen Prüfserver überschreibbar.
 *   In der Produktion gibt es diesen Weg nicht: der Worker ruft handleAdmin ohne
 *   Optionen auf, sodass immer die Access-Prüfung greift.
 */
export async function handleAdmin(request, env, optionen = {}) {
  const pruefeAnmeldung = optionen.pruefeAnmeldung ?? angemeldeterBenutzer;

  let benutzer;
  try {
    benutzer = await pruefeAnmeldung(request, env);
  } catch (fehler) {
    const istApi = new URL(request.url).pathname.startsWith("/admin/api/");
    if (istApi) return json({ fehler: fehler.message }, 403);
    return html(
      seite("Kein Zugang", `<h1>Kein Zugang</h1><p class="meldung fehler">${escapeHtml(fehler.message)}</p>`),
      403
    );
  }

  const url = new URL(request.url);
  const pfad = url.pathname.replace(/\/$/, "") || "/admin";

  try {
    if (pfad === "/admin" && request.method === "GET") {
      return html(uebersichtSeite(await loadCountries(env), benutzer));
    }

    if (pfad === "/admin/buddha" && request.method === "GET") {
      return html(buddhaSeite(await loadBuddhaTexte(env), benutzer));
    }

    if (pfad === "/admin/api/buddha" && request.method === "POST") {
      await saveBuddhaTexte(env, await request.json(), benutzer);
      cacheLeeren();
      return json({ ok: true });
    }

    const bearbeiten = pfad.match(/^\/admin\/land\/([a-z0-9-]+)$/);
    if (bearbeiten && request.method === "GET") {
      const country = await loadCountry(env, bearbeiten[1]);
      if (!country) return html(seite("Nicht gefunden", "<h1>Land nicht gefunden</h1>"), 404);
      return html(bearbeitenSeite(country, benutzer));
    }

    const speichern = pfad.match(/^\/admin\/api\/land\/([a-z0-9-]+)$/);
    if (speichern && request.method === "POST") {
      await saveCountry(env, speichern[1], await request.json(), benutzer);
      cacheLeeren();
      return json({ ok: true });
    }

    const recherche = pfad.match(/^\/admin\/api\/recherche\/([a-z0-9-]+)$/);
    if (recherche && request.method === "POST") {
      const country = await loadCountry(env, recherche[1]);
      if (!country) return json({ fehler: "Land nicht gefunden" }, 404);
      try {
        const ergebnis = await landRecherchieren(env, country);
        await protokolliereRecherche(env, country.id, {
          benutzer,
          model: ergebnis.modell,
          status: "offen",
          proposal: ergebnis.vorschlag,
          input_tokens: ergebnis.input_tokens,
          output_tokens: ergebnis.output_tokens
        });
        return json(ergebnis);
      } catch (fehler) {
        await protokolliereRecherche(env, country.id, { benutzer, status: "fehler", error: fehler.message });
        return json({ fehler: fehler.message }, 502);
      }
    }

    const uebersetzen = pfad.match(/^\/admin\/api\/uebersetzen\/([a-z0-9-]+)$/);
    if (uebersetzen && request.method === "POST") {
      const daten = await request.json();
      return json({ daten: await deutscheFelderErgaenzen(env, daten) });
    }

    return html(seite("Nicht gefunden", "<h1>Seite nicht gefunden</h1>"), 404);
  } catch (fehler) {
    const istApi = pfad.startsWith("/admin/api/");
    if (istApi) return json({ fehler: fehler.message }, 500);
    return html(seite("Fehler", `<h1>Fehler</h1><p class="meldung fehler">${escapeHtml(fehler.message)}</p>`), 500);
  }
}

// Sammelt alle deutschen Felder ohne englische Entsprechung, übersetzt sie in
// einem Aufruf und trägt sie zurück in die Struktur ein.
async function deutscheFelderErgaenzen(env, daten) {
  const auftraege = [];
  const setzer = new Map();

  const merken = (schluessel, de, setzen) => {
    if (!de?.trim()) return;
    auftraege.push({ key: schluessel, de });
    setzer.set(schluessel, setzen);
  };

  for (const [de, en] of [["spirit", "spirit"], ["subtitle", "subtitle"], ["notice", "notice"]]) {
    if (!daten[`${en}_en`]) merken(`${de}`, daten[`${de}_de`], (wert) => (daten[`${en}_en`] = wert));
  }

  (daten.paragraphs ?? []).forEach((p, i) => {
    if (!p.text_en) merken(`absatz_${i}`, p.text_de, (wert) => (p.text_en = wert));
  });

  (daten.facts ?? []).forEach((f, i) => {
    if (!f.label_en) merken(`faktname_${i}`, f.label_de, (wert) => (f.label_en = wert));
    if (!f.value_en) merken(`faktwert_${i}`, f.value_de, (wert) => (f.value_en = wert));
  });

  (daten.producers ?? []).forEach((pr, i) => {
    if (!pr.label_en) merken(`herstellerlabel_${i}`, pr.label_de, (wert) => (pr.label_en = wert));
    if (!pr.origin_en) merken(`herkunft_${i}`, pr.origin_de, (wert) => (pr.origin_en = wert));
    (pr.products ?? []).forEach((p, j) => {
      for (const feld of ["tier_label", "meta", "description", "availability", "category", "ingredients", "abv", "positioning"]) {
        if (!p[`${feld}_en`]) {
          merken(`p${i}_${j}_${feld}`, p[`${feld}_de`], (wert) => (p[`${feld}_en`] = wert));
        }
      }
    });
  });

  if (!auftraege.length) return daten;

  const uebersetzungen = await felderUebersetzen(env, auftraege);
  for (const [schluessel, wert] of Object.entries(uebersetzungen)) {
    setzer.get(schluessel)?.(wert);
  }
  return daten;
}
