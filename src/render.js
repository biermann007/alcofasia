// Erzeugt aus den Datensätzen genau das HTML, das bisher von Hand in
// index.html und list/index.html gepflegt wurde.
//
// Jeder übersetzbare Knoten bekommt ein data-en-Attribut. Damit entfällt das
// Wörterbuch in site-ui.js: die englische Fassung steht direkt am Element.

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Schreibt data-en nur, wenn sich die englische Fassung vom Deutschen
// unterscheidet – sonst bläht es das HTML unnötig auf.
const enAttr = (de, en) => {
  if (!en || en === de) return "";
  return ` data-en="${escapeHtml(en)}"`;
};

const zeile = (tag, klasse, de, en, extra = "") => {
  if (de == null || de === "") return "";
  const cls = klasse ? ` class="${klasse}"` : "";
  return `<${tag}${cls}${extra}${enAttr(de, en)}>${escapeHtml(de)}</${tag}>`;
};

function renderProduct(product) {
  return `
              <div class="product-card">
                ${zeile("p", "product-label", product.tier_label_de, product.tier_label_en)}
                <h3 class="product-name">${escapeHtml(product.name)}</h3>
                ${zeile("p", "product-meta", product.meta_de, product.meta_en)}
                ${zeile("p", "product-description", product.description_de, product.description_en)}
                ${zeile("span", "availability", product.availability_de, product.availability_en)}
              </div>`;
}

function renderProducer(producer) {
  const produkte = producer.products.map(renderProduct).join("");

  // position 0 bedeutet: kein Hersteller, nur eine einzelne Karte
  // (z. B. Afghanistan, wo es keine legale Auswahl gibt).
  if (!producer.name) return produkte.replace(/^\n {14}/, "\n          ");

  return `
          <div class="manufacturer-block">
            ${zeile("p", "product-label", producer.label_de, producer.label_en)}
            <h3 class="manufacturer-title">${escapeHtml(producer.name)}</h3>
            <div class="product-grid">${produkte}
            </div>
          </div>`;
}

// Produkte werden an zwei Stellen freigegeben, und beide müssen zustimmen:
//
//   1. der seitenweite Schalter unter /admin/einstellungen (Not-Aus)
//   2. der Haken beim einzelnen Land auf /admin/land/…
//
// Fehlt eine der beiden Angaben – etwa weil eine Migration noch nicht
// eingespielt ist – gilt der bisherige Zustand: Produkte werden gezeigt.
const zeigtProdukte = (optionen) => optionen?.produkteAnzeigen !== false;

// Nur eine ausdrückliche 0 (bzw. "0"/false) blendet ein Land aus. undefined,
// null und 1 bedeuten "zeigen".
const landZeigtProdukte = (country) => {
  const wert = country?.produkte_anzeigen;
  if (wert == null) return true;
  return !(wert === 0 || wert === "0" || wert === false);
};

// Beides zusammen: zeigt dieses Land gerade Produkte?
const produkteSichtbar = (country, optionen) => zeigtProdukte(optionen) && landZeigtProdukte(country);

export function renderCountryDetail(country, optionen = {}) {
  const absaetze = country.paragraphs
    .map((p) => `\n            ${zeile("p", null, p.text_de, p.text_en)}`)
    .join("");

  const fakten = country.facts
    .map(
      (f) =>
        `\n            <div>${zeile("dt", null, f.label_de, f.label_en)}${zeile("dd", null, f.value_de, f.value_en)}</div>`
    )
    .join("");

  // Ist einer der beiden Schalter aus, entfallen Hersteller- und Produktkarten
  // ersatzlos. Fließtext, Fakten, rechtlicher Hinweis und Quellen bleiben stehen.
  const hersteller = produkteSichtbar(country, optionen)
    ? country.producers.map(renderProducer).join("")
    : "";

  const hinweis = country.notice_de
    ? `
          <div class="country-copy country-note">
            ${zeile("p", null, country.notice_de, country.notice_en)}
          </div>`
    : "";

  const quellen = country.sources.length
    ? `
          <p class="sources"><span data-en="Sources:">Quellen:</span> ${country.sources
            .map(
              (s) =>
                `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>`
            )
            .join(" · ")}</p>`
    : "";

  return `
        <article class="country-detail" data-country-detail="${escapeHtml(country.name_de)}" hidden tabindex="-1">
          <button class="detail-back" type="button" data-detail-back data-en="← Back">← Zurück</button>
          ${zeile("p", "country-kicker", country.name_de, country.name_en)}
          ${zeile("h2", null, country.spirit_de, country.spirit_en)}
          ${zeile("p", "country-subtitle", country.subtitle_de, country.subtitle_en)}
          <div class="country-copy">${absaetze}
          </div>
          <dl class="spirit-facts">${fakten}
          </dl>${hersteller}${hinweis}${quellen}
          <button class="detail-back detail-back-bottom" type="button" data-detail-back data-en="← Back">← Zurück</button>
        </article>`;
}

export function renderCountryDetails(countries, optionen = {}) {
  return countries
    .filter((c) => c.status === "veroeffentlicht")
    .map((c) => renderCountryDetail(c, optionen))
    .join("");
}

// Die Farbwelt je Land stand bisher fest im CSS von index.html. Jetzt kommt sie
// aus der Datenbank, damit sie im Admin einstellbar ist.
export function renderCountryColors(countries) {
  const regeln = countries
    .filter((c) => c.status === "veroeffentlicht" && c.glow_rgb)
    .map(
      (c) => `.asia-map path.has-content[data-country="${c.name_de}"] {
        --country-glow: ${c.glow_rgb};
        --country-stroke: ${c.stroke_hex};
        --country-fill: ${c.fill_hex};
        --country-hover-fill: ${c.hover_fill_hex};
        --country-dark-fill: ${c.dark_fill_hex};
        --country-dark-hover-fill: ${c.dark_hover_hex};${
          c.glow_delay ? `\n        animation-delay: ${c.glow_delay};` : ""
        }
      }`
    )
    .join("\n\n      ");

  return regeln ? `\n      ${regeln}\n    ` : "";
}

// Die Karte braucht die Zuordnung deutscher auf englische Ländernamen für
// Tooltip und Länderliste. Bisher stand sie fest in site-ui.js.
//
// Zusätzlich bekommt das Laufband über der Karte je Land seinen Zustand:
//   verboten – Alkohol ist im Land verboten, Eintrag erscheint rot
//   inhalt   – es gibt eine Detailseite, Eintrag leuchtet
//   leer     – noch nichts hinterlegt, Eintrag ist nur Text ohne Verweis
export function renderCountryNames(countries) {
  const paare = Object.fromEntries(countries.map((c) => [c.name_de, c.name_en]));

  const laender = countries.map((c) => ({
    de: c.name_de,
    en: c.name_en,
    zustand: c.alkoholverbot ? "verboten" : c.status === "veroeffentlicht" ? "inhalt" : "leer",
    // Nur gesetzt, wenn das Land eine eigene Farbe trägt – sonst leuchtet es
    // in der Grundfarbe der Seite.
    glow: c.glow_rgb ?? null
  }));

  return (
    `window.alcofasiaCountryNames = ${JSON.stringify(paare)};\n` +
    `window.alcofasiaLaender = ${JSON.stringify(laender)};`
  );
}

const LISTEN_SPALTEN = [
  ["Name", "Country"],
  ["Herstellerwahl", "Producer selection"],
  ["Kategorie", "Category"],
  ["Produkt", "Product"],
  ["Hersteller", "Producer"],
  ["Herkunft", "Origin"],
  ["Stil", "Style"],
  ["Zutaten", "Ingredients"],
  ["Alkoholgehalt", "Alcohol content"],
  ["Einordnung", "Positioning"]
];

// Hat die Tabelle überhaupt eine Zeile? Wird sowohl für den Tabellenkopf als
// auch für den Hinweis anstelle der Tabelle gebraucht.
export function listeHatZeilen(countries, optionen = {}) {
  if (!zeigtProdukte(optionen)) return false;
  return (countries ?? []).some(
    (c) =>
      c.status === "veroeffentlicht" &&
      landZeigtProdukte(c) &&
      c.producers.some((p) => p.products.length)
  );
}

// countries ist zweitrangig und darf fehlen – dann wird der Kopf gezeigt wie
// bisher. Der Worker übergibt die Länder, damit der Kopf verschwindet, wenn
// kein einziges Land mehr Produkte zeigt.
export function renderListHead(optionen = {}, countries = null) {
  if (!zeigtProdukte(optionen)) return "";
  if (countries && !listeHatZeilen(countries, optionen)) return "";

  return `
            <tr>${LISTEN_SPALTEN.map(
              ([de, en]) => `\n              <th scope="col"${enAttr(de, en)}>${escapeHtml(de)}</th>`
            ).join("")}
            </tr>`;
}

const LISTE_LEER = `
            <tr class="list-leer">
              <td data-en="Products are currently not shown.">Produkte werden zurzeit nicht angezeigt.</td>
            </tr>`;

export function renderListRows(countries, optionen = {}) {
  if (!zeigtProdukte(optionen)) return LISTE_LEER;

  const zellen = [];

  // Länder ohne Haken bleiben aus der Tabelle heraus; ihre Produkte stehen
  // unverändert in der Datenbank.
  for (const country of countries.filter((c) => c.status === "veroeffentlicht" && landZeigtProdukte(c))) {
    for (const producer of country.producers) {
      for (const product of producer.products) {
        const werte = [
          [country.name_de, country.name_en],
          [producer.label_de ?? "–", producer.label_en ?? "–"],
          [product.tier_list_de ?? product.tier_label_de ?? "–", product.tier_list_en ?? product.tier_label_en ?? "–"],
          [product.name, product.name],
          [producer.name ?? "Kein legaler Hersteller nachweisbar", producer.name ?? "No legal producer identified"],
          [producer.origin_de ?? "–", producer.origin_en ?? "–"],
          [product.category_de ?? "–", product.category_en ?? "–"],
          [product.ingredients_de ?? "–", product.ingredients_en ?? "–"],
          [product.abv_de ?? "–", product.abv_en ?? "–"],
          [product.positioning_de ?? "–", product.positioning_en ?? "–"]
        ];

        const [[landDe, landEn], ...rest] = werte;
        zellen.push(
          `
            <tr>
              <th scope="row"${enAttr(landDe, landEn)}>${escapeHtml(landDe)}</th>${rest
                .map(([de, en]) => `\n              <td${enAttr(de, en)}>${escapeHtml(de)}</td>`)
                .join("")}
            </tr>`
        );
      }
    }
  }

  // Kein einziges Land zeigt noch Produkte: dann steht dort derselbe Hinweis
  // wie beim seitenweiten Ausschalten, statt einer leeren Tabelle.
  return zellen.length ? zellen.join("") : LISTE_LEER;
}

// ------------------------------------------------------------- Buddha-Seite

// Alphabetische Liste aller veröffentlichten Länder mit ihrem Getränk, z. B.
// "Russland — Vodka". Jeder Eintrag verlinkt über /#land=… direkt auf die
// Detailansicht der Startseite (map.js öffnet sie beim Laden).
export function renderBuddhaLaender(countries) {
  return countries
    .filter((c) => c.status === "veroeffentlicht")
    .sort((a, b) => a.name_de.localeCompare(b.name_de, "de"))
    .map((c) => {
      const de = c.spirit_de ? `${c.name_de} — ${c.spirit_de}` : c.name_de;
      const en = (c.name_en || c.spirit_en)
        ? (c.spirit_en || c.spirit_de
            ? `${c.name_en ?? c.name_de} — ${c.spirit_en ?? c.spirit_de}`
            : c.name_en ?? c.name_de)
        : de;
      return `\n            <li><a href="/#land=${encodeURIComponent(c.name_de)}"${enAttr(de, en)}>${escapeHtml(de)}</a></li>`;
    })
    .join("");
}

// Ein Buddha-Textbereich. Kein HTML – stattdessen drei einfache Regeln:
// Leerzeilen trennen Absätze, einzelne Zeilenumbrüche bleiben erhalten
// (CSS white-space: pre-line auf der Seite), und ein Block, der mit "## "
// beginnt, wird zur Zwischenüberschrift. Die englische Fassung wird Block
// für Block zugeordnet – fehlt sie, bleibt der deutsche Text stehen.
export function renderBuddhaText(eintrag = {}) {
  const bloecke = (wert) =>
    String(wert ?? "")
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean);

  const de = bloecke(eintrag?.text_de);
  const en = bloecke(eintrag?.text_en);

  const ohneRaute = (t) => (t?.startsWith("## ") ? t.slice(3).trim() : t);

  return de
    .map((text, i) => {
      const tag = text.startsWith("## ") ? "h3" : "p";
      return `\n          ${zeile(tag, null, ohneRaute(text), ohneRaute(en[i]))}`;
    })
    .join("");
}

// ------------------------------------------------------------------- Arena

// Die Arena-Spiele brauchen je Land nur den Namen und das Getränk, beides in
// beiden Sprachen. Nur veröffentlichte Länder mit eingetragenem Getränk kommen
// mit – ein Land ohne legales Getränk (z. B. Afghanistan) wäre sonst eine
// unlösbare Quizfrage.
export function renderArenaLaender(countries) {
  const laender = countries
    .filter((c) => c.status === "veroeffentlicht" && c.spirit_de)
    .map((c) => ({
      de: c.name_de,
      en: c.name_en ?? c.name_de,
      getraenkDe: c.spirit_de,
      getraenkEn: c.spirit_en ?? c.spirit_de
    }));

  return `window.alcofasiaArenaLaender = ${JSON.stringify(laender)};`;
}
