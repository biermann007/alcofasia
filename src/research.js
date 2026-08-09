// Recherche und Übersetzung über die Anthropic-API.
//
// Der Vorschlag wird nie direkt gespeichert. Er geht an den Adminbereich, wird
// dort dem aktuellen Stand gegenübergestellt und feldweise übernommen.

const API = "https://api.anthropic.com/v1/messages";
const STANDARD_MODELL = "claude-sonnet-4-5";

const PRODUKT_SCHEMA = {
  type: "object",
  properties: {
    tier: { type: "string", enum: ["low", "standard", "premium"], description: "Preisstufe" },
    name: { type: "string", description: "Genauer Produktname wie auf der Flasche" },
    meta_de: { type: "string", description: "Kategorie, Alkoholgehalt und Flaschengröße, z. B. 'Baijiu · 53 % Vol. · 500 ml'" },
    meta_en: { type: "string" },
    description_de: { type: "string", description: "Ein Satz zum Geschmacksprofil, sachlich, ohne Werbesprache" },
    description_en: { type: "string" },
    category_de: { type: "string", description: "Stilbezeichnung, z. B. 'Sauce Aroma Baijiu'" },
    category_en: { type: "string" },
    ingredients_de: { type: "string", description: "Zutaten, z. B. 'Rotes Sorghum, Weizen, Wasser'" },
    ingredients_en: { type: "string" },
    abv_de: { type: "string", description: "Alkoholgehalt im Format '53 % Vol.'" },
    abv_en: { type: "string", description: "Alkoholgehalt im Format '53% ABV'" },
    positioning_de: { type: "string", description: "Kurze Einordnung, z. B. 'Bekanntestes Flaggschiff'" },
    positioning_en: { type: "string" }
  },
  required: ["tier", "name", "meta_de", "description_de", "category_de", "abv_de", "positioning_de"]
};

const VORSCHLAG_SCHEMA = {
  type: "object",
  properties: {
    keine_legale_auswahl: {
      type: "boolean",
      description: "true, wenn im Land kein legal vermarktetes nationales Destillat existiert (z. B. bei einem Alkoholverbot)"
    },
    spirit_de: { type: "string", description: "Name der landestypischen Spirituose, z. B. 'Baijiu'" },
    spirit_en: { type: "string" },
    subtitle_de: { type: "string", description: "Halbsatz als Untertitel, z. B. 'Chinas bekannteste Spirituose'" },
    subtitle_en: { type: "string" },
    paragraphs: {
      type: "array",
      description: "Drei bis vier Absätze: was die Spirituose ist, wie sie getrunken wird, welche Hersteller gewählt wurden und was sie unterscheidet",
      items: {
        type: "object",
        properties: { text_de: { type: "string" }, text_en: { type: "string" } },
        required: ["text_de"]
      }
    },
    facts: {
      type: "array",
      description: "Sechs Zeilen für die Faktenliste: Spirituose, Stil, Herkunft, Zutaten, Hersteller, Sortiment",
      items: {
        type: "object",
        properties: {
          label_de: { type: "string" }, label_en: { type: "string" },
          value_de: { type: "string" }, value_en: { type: "string" }
        },
        required: ["label_de", "value_de"]
      }
    },
    producers: {
      type: "array",
      description: "Bis zu drei etablierte Hersteller mit je drei Produktstufen",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vollständiger Firmenname" },
          origin_de: { type: "string", description: "Ort, Region, Land" },
          origin_en: { type: "string" },
          products: { type: "array", items: PRODUKT_SCHEMA }
        },
        required: ["name", "origin_de", "products"]
      }
    },
    notice_de: {
      type: "string",
      description: "Nur setzen, wenn es einen rechtlichen Vorbehalt gibt, etwa ein EU-Einfuhrverbot"
    },
    notice_en: { type: "string" },
    sources: {
      type: "array",
      description: "Belege, bevorzugt Herstellerseiten und amtliche Quellen",
      items: {
        type: "object",
        properties: { title: { type: "string" }, url: { type: "string" } },
        required: ["title", "url"]
      }
    },
    unsicherheiten: {
      type: "array",
      description: "Angaben, die nicht sicher belegt werden konnten, im Klartext",
      items: { type: "string" }
    }
  },
  required: ["keine_legale_auswahl", "spirit_de", "subtitle_de", "paragraphs", "facts", "producers", "sources"]
};

const ANWEISUNG = `Du recherchierst für alcofasia.com, eine zweisprachige Übersicht über die landestypischen Spirituosen Asiens.

Vorgehen:
- Recherchiere mit der Websuche. Stütze jede Angabe auf eine Quelle, bevorzugt Herstellerseiten, Branchenverbände oder amtliche Stellen.
- Wähle die landestypische Spirituose, nicht ein importiertes Produkt. Ist das bekannteste alkoholische Getränk keine Spirituose (etwa Sake, der gebraut wird), benenne das und wähle die tatsächliche Spirituose.
- Wähle bis zu drei etablierte Hersteller und je drei Abfüllungen in den Stufen low, standard und premium.
- Gibt es im Land keine legal vermarktete nationale Spirituose, setze keine_legale_auswahl auf true, lasse producers leer und beschreibe die Rechtslage in den Absätzen.
- Bestehen Einfuhr- oder Verkaufsbeschränkungen für den europäischen Markt, halte sie in notice_de fest.

Ton: sachlich, knapp, keine Werbesprache, keine Kaufempfehlungen. Deutsch ist die Ausgangssprache, die englischen Felder sind eine treue Übersetzung im selben nüchternen Ton.

Erfinde nichts. Was du nicht belegen kannst, lässt du weg und trägst es in unsicherheiten ein. Lieber zwei belegte Hersteller als drei, von denen einer geraten ist.`;

async function anthropicAufrufen(env, { system, messages, tools, tool_choice, max_tokens }) {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt. Ohne Schlüssel kann nicht recherchiert werden.");
  }

  const antwort = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || STANDARD_MODELL,
      max_tokens: max_tokens ?? 8000,
      system,
      messages,
      tools,
      tool_choice
    })
  });

  const text = await antwort.text();
  if (!antwort.ok) {
    let grund = text;
    try {
      grund = JSON.parse(text).error?.message ?? text;
    } catch {
      // Rohtext beibehalten
    }
    throw new Error(`Anthropic-API antwortet mit ${antwort.status}: ${grund}`);
  }
  return JSON.parse(text);
}

/**
 * Recherchiert ein Land und liefert einen strukturierten Vorschlag.
 */
export async function landRecherchieren(env, country) {
  const bestand = country.status === "veroeffentlicht"
    ? `\n\nEs gibt bereits einen gepflegten Stand. Prüfe ihn, ergänze Lücken und korrigiere Veraltetes:\n${JSON.stringify(
        {
          spirit_de: country.spirit_de,
          producers: country.producers.map((p) => ({ name: p.name, products: p.products.map((x) => x.name) }))
        },
        null,
        2
      )}`
    : "";

  const ergebnis = await anthropicAufrufen(env, {
    system: ANWEISUNG,
    max_tokens: 12000,
    messages: [
      {
        role: "user",
        content: `Recherchiere die landestypische Spirituose für ${country.name_de} (englisch: ${country.name_en}).${bestand}\n\nRufe am Ende das Werkzeug laenderdaten_vorschlagen mit dem vollständigen Ergebnis auf.`
      }
    ],
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: 12 },
      {
        name: "laenderdaten_vorschlagen",
        description: "Übergibt den fertig recherchierten Länderdatensatz an die Redaktion.",
        input_schema: VORSCHLAG_SCHEMA
      }
    ]
  });

  const aufruf = ergebnis.content?.find((b) => b.type === "tool_use" && b.name === "laenderdaten_vorschlagen");
  if (!aufruf) {
    const text = ergebnis.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    throw new Error(
      text
        ? `Es kam kein strukturierter Vorschlag zurück. Antwort war: ${text.slice(0, 400)}`
        : "Es kam kein strukturierter Vorschlag zurück."
    );
  }

  const quellenAusSuche = (ergebnis.content ?? [])
    .filter((b) => b.type === "web_search_tool_result")
    .flatMap((b) => (Array.isArray(b.content) ? b.content : []))
    .map((t) => t.url)
    .filter(Boolean);

  return {
    vorschlag: aufruf.input,
    besuchteQuellen: [...new Set(quellenAusSuche)],
    modell: ergebnis.model,
    input_tokens: ergebnis.usage?.input_tokens ?? null,
    output_tokens: ergebnis.usage?.output_tokens ?? null
  };
}

/**
 * Übersetzt gezielt die deutschen Felder eines Landes ins Englische.
 * Erwartet und liefert eine flache Liste, damit die Zuordnung eindeutig bleibt.
 */
export async function felderUebersetzen(env, felder) {
  const zuUebersetzen = felder.filter((f) => f.de?.trim());
  if (!zuUebersetzen.length) return {};

  const ergebnis = await anthropicAufrufen(env, {
    system:
      "Du übersetzt redaktionelle Texte einer Spirituosen-Übersicht aus dem Deutschen ins Englische. " +
      "Sachlich und knapp, keine Werbesprache. Eigennamen, Marken und Ortsnamen bleiben unverändert. " +
      "Alkoholangaben werden von '53 % Vol.' zu '53% ABV'. Übersetze jeden Eintrag einzeln und gib den Schlüssel unverändert zurück.",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `Übersetze diese Einträge:\n${JSON.stringify(
          Object.fromEntries(zuUebersetzen.map((f) => [f.key, f.de])),
          null,
          2
        )}`
      }
    ],
    tools: [
      {
        name: "uebersetzungen_liefern",
        description: "Gibt die englischen Fassungen zurück.",
        input_schema: {
          type: "object",
          properties: {
            uebersetzungen: {
              type: "array",
              items: {
                type: "object",
                properties: { key: { type: "string" }, en: { type: "string" } },
                required: ["key", "en"]
              }
            }
          },
          required: ["uebersetzungen"]
        }
      }
    ],
    tool_choice: { type: "tool", name: "uebersetzungen_liefern" }
  });

  const aufruf = ergebnis.content?.find((b) => b.type === "tool_use");
  if (!aufruf) throw new Error("Es kamen keine Übersetzungen zurück.");

  return Object.fromEntries((aufruf.input.uebersetzungen ?? []).map((u) => [u.key, u.en]));
}
