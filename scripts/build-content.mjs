import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [indexHtml, listHtml, uiSource] = await Promise.all([
  readFile(new URL("public/index.html", root), "utf8"),
  readFile(new URL("public/list/index.html", root), "utf8"),
  readFile(new URL("public/site-ui.js", root), "utf8")
]);

const decode = (value = "") => value
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]*>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, " ")
  .replace(/&ndash;/g, "–")
  .replace(/&mdash;/g, "—")
  .replace(/&middot;/g, "·")
  .replace(/\s+/g, " ")
  .trim();

const objectLiteral = (name) => {
  const match = uiSource.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));

  if (!match) {
    throw new Error(`Could not find ${name} in site-ui.js`);
  }

  return vm.runInNewContext(`(${match[1]})`, Object.create(null));
};

const english = objectLiteral("english");
const countryNames = objectLiteral("countryNames");
const localized = (value) => ({
  de: value,
  en: english[value] ?? countryNames[value] ?? value
});

const first = (source, pattern) => decode(source.match(pattern)?.[1]);
const all = (source, pattern) => [...source.matchAll(pattern)].map((match) => decode(match[1]));
const chunks = (source, marker, endMarkers = []) => {
  const starts = [...source.matchAll(marker)].map((match) => match.index);

  return starts.map((start, index) => {
    const candidates = [starts[index + 1], ...endMarkers.map((endMarker) => source.indexOf(endMarker, start + 1))]
      .filter((position) => Number.isInteger(position) && position > start);
    const end = candidates.length ? Math.min(...candidates) : source.length;
    return source.slice(start, end);
  });
};

const tableRows = [...listHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  .map((match) => all(match[1], /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/g))
  .filter((cells) => cells.length >= 10)
  .map((cells) => {
    if (cells.length === 11 && cells[2] === cells[3]) {
      cells.splice(3, 1);
    }

    const [country, manufacturerChoice, tier, product, manufacturer, origin, style, ingredients, alcohol, classification] = cells;
    return { country, manufacturerChoice, tier, product, manufacturer, origin, style, ingredients, alcohol, classification };
  });

const articleMatches = [...indexHtml.matchAll(/<article class="country-detail" data-country-detail="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
const countries = articleMatches.map(([, key, article]) => {
  const title = first(article, /<h2>([\s\S]*?)<\/h2>/);
  const subtitle = first(article, /<p class="country-subtitle">([\s\S]*?)<\/p>/);
  const copyBlock = article.match(/<div class="country-copy">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const factsBlock = article.match(/<dl class="spirit-facts">([\s\S]*?)<\/dl>/)?.[1] ?? "";
  const facts = [...factsBlock.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((match) => ({
    label: localized(decode(match[1])),
    value: localized(decode(match[2]))
  }));
  const manufacturerChunks = chunks(
    article,
    /<div class="manufacturer-block">/g,
    ['<p class="country-note">', '<p class="sources">', '<button class="detail-back detail-back-bottom"']
  );

  if (manufacturerChunks.length === 0) {
    const standalone = article.match(/<div class="product-card">([\s\S]*?)<\/div>/)?.[0];
    if (standalone) {
      manufacturerChunks.push(`<div class="manufacturer-block"><p class="product-label">–</p><h3 class="manufacturer-title">–</h3><div class="product-grid">${standalone}</div></div>`);
    }
  }

  const manufacturers = manufacturerChunks.map((manufacturerChunk, manufacturerIndex) => {
    const name = first(manufacturerChunk, /<h3 class="manufacturer-title">([\s\S]*?)<\/h3>/);
    const label = first(manufacturerChunk, /<p class="product-label">([\s\S]*?)<\/p>/);
    const productChunks = chunks(manufacturerChunk, /<div class="product-card">/g);
    const products = productChunks.map((productChunk) => {
      const productName = first(productChunk, /<h3 class="product-name">([\s\S]*?)<\/h3>/);
      const listRow = tableRows.find((row) => row.country === key && row.product === productName);

      return {
        tier: localized(first(productChunk, /<p class="product-label">([\s\S]*?)<\/p>/)),
        name: productName,
        meta: localized(first(productChunk, /<p class="product-meta">([\s\S]*?)<\/p>/)),
        description: localized(first(productChunk, /<p class="product-description">([\s\S]*?)<\/p>/)),
        availability: localized(first(productChunk, /<span class="availability">([\s\S]*?)<\/span>/)),
        list: {
          origin: localized(listRow?.origin ?? key),
          style: localized(listRow?.style ?? title),
          ingredients: localized(listRow?.ingredients ?? "–"),
          alcohol: localized(listRow?.alcohol ?? "–"),
          classification: localized(listRow?.classification ?? "–")
        }
      };
    });

    return {
      label: localized(label || `${manufacturerIndex + 1}. Hersteller`),
      name: name === "–" ? "" : name,
      products
    };
  });
  const sourcesBlock = article.match(/<p class="sources">([\s\S]*?)<\/p>/)?.[1] ?? "";
  const sources = [...sourcesBlock.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
    url: match[1],
    label: localized(decode(match[2]))
  }));

  return {
    key,
    name: localized(key),
    title: localized(title),
    subtitle: localized(subtitle),
    paragraphs: all(copyBlock, /<p>([\s\S]*?)<\/p>/g).map(localized),
    facts,
    manufacturers,
    note: localized(first(article, /<p class="country-note product-description">([\s\S]*?)<\/p>/)),
    sources
  };
});

const content = {
  version: 1,
  generatedAt: new Date().toISOString(),
  countries
};

await writeFile(
  new URL("public/content.json", root),
  `${JSON.stringify(content, null, 2)}\n`,
  "utf8"
);

console.log(`Created content.json with ${countries.length} countries and ${countries.flatMap((country) => country.manufacturers.flatMap((manufacturer) => manufacturer.products)).length} products.`);
