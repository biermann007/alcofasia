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

export function renderCountryDetail(country) {
  const absaetze = country.paragraphs
    .map((p) => `\n            ${zeile("p", null, p.text_de, p.text_en)}`)
    .join("");

  const fakten = country.facts
    .map(
      (f) =>
        `\n            <div>${zeile("dt", null, f.label_de, f.label_en)}${zeile("dd", null, f.value_de, f.value_en)}</div>`
    )
    .join("");

  const hersteller = country.producers.map(renderProducer).join("");

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

export function renderCountryDetails(countries) {
  return countries
    .filter((c) => c.status === "veroeffentlicht")
    .map(renderCountryDetail)
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

export function renderListHead() {
  return `
            <tr>${LISTEN_SPALTEN.map(
              ([de, en]) => `\n              <th scope="col"${enAttr(de, en)}>${escapeHtml(de)}</th>`
            ).join("")}
            </tr>`;
}

export function renderListRows(countries) {
  const zellen = [];

  for (const country of countries.filter((c) => c.status === "veroeffentlicht")) {
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

  return zellen.join("");
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

// Ein Buddha-Textbereich. Leerzeilen in der Eingabe trennen Absätze; die
// englische Fassung wird Absatz für Absatz zugeordnet – fehlt sie für einen
// Absatz, bleibt dort der deutsche Text stehen.
export function renderBuddhaText(eintrag = {}) {
  const absaetze = (wert) =>
    String(wert ?? "")
      .split(/\n\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean);

  const de = absaetze(eintrag?.text_de);
  const en = absaetze(eintrag?.text_en);

  return de.map((text, i) => `\n          ${zeile("p", null, text, en[i])}`).join("");
}
