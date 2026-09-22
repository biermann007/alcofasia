// Recherche und Übersetzung über die Anthropic-API.
//
// Der Vorschlag wird nie direkt gespeichert. Er geht an den Adminbereich, wird
// dort dem aktuellen Stand gegenübergestellt und feldweise übernommen.
//
// Die Recherche liefert nur die deutschen Felder – das halbiert die Ausgabe
// und damit die Wartezeit. Englisch ergänzt der Übersetzungsschritt im Admin.

const API = "https://api.anthropic.com/v1/messages";
const STANDARD_MODELL = "claude-sonnet-4-5";
const STANDARD_UEBERSETZ_MODELL = "claude-haiku-4-5";

const PRODUKT_SCHEMA = {
  type: "object",
  properties: {
    tier: { type: "string", enum: ["low", "standard", "premium"], description: "Preisstufe" },
    name: { type: "string", description: "Genauer Produktname wie auf der Flasche" },
    meta_de: { type: "string", description: "Kategorie, Alkoholgehalt und Flaschengröße, z. B. 'Baijiu · 53 % Vol. · 500 ml'" },
    description_de: { type: "string", description: "Ein Satz zum Geschmacksprofil, sachlich, ohne Werbesprache" },
    category_de: { type: "string", description: "Stilbezeichnung, z. B. 'Sauce Aroma Baijiu'" },
    ingredients_de: { type: "string", description: "Zutaten, z. B. 'Rotes Sorghum, Weizen, Wasser'" },
    abv_de: { type: "string", description: "Alkoholgehalt im Format '53 % Vol.'" },
    positioning_de: { type: "string", description: "Kurze Einordnung, z. B. 'Bekanntestes Flaggschiff'" }
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
    subtitle_de: { type: "string", description: "Halbsatz als Untertitel, z. B. 'Chinas bekannteste Spirituose'" },
    paragraphs: {
      type: "array",
      description: "Drei bis vier Absätze: was die Spirituose ist, wie sie getrunken wird, welche Hersteller gewählt wurden und was sie unterscheidet",
      items: {
        type: "object",
        properties: { text_de: { type: "string" } },
        required: ["text_de"]
      }
    },
    facts: {
      type: "array",
      description: "Sechs Zeilen für die Faktenliste: Spirituose, Stil, Herkunft, Zutaten, Hersteller, Sortiment",
      items: {
        type: "object",
        properties: {
          label_de: { type: "string" },
          value_de: { type: "string" }
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
          products: { type: "array", items: PRODUKT_SCHEMA }
        },
        required: ["name", "origin_de", "products"]
      }
    },
    notice_de: {
      type: "string",
      description: "Nur setzen, wenn es einen rechtlichen Vorbehalt gibt, etwa ein EU-Einfuhrverbot"
    },
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
- Recherchiere mit der Websuche – wenige gezielte Suchen, zuerst Hersteller und amtliche Quellen, nicht breit streuen. Nutze die Suchfilterung: behalte nur Treffer zu landestypischer Spirituose, Herstellern und Rechtslage; Tourismus-, Rezept- und Shop-Listen ohne Belegwert verwerfen. Stütze jede Angabe auf eine Quelle, bevorzugt Herstellerseiten, Branchenverbände oder amtliche Stellen.
- Wähle die landestypische Spirituose, nicht ein importiertes Produkt. Ist das bekannteste alkoholische Getränk keine Spirituose (etwa Sake, der gebraut wird), benenne das und wähle die tatsächliche Spirituose.
- Wähle bis zu drei etablierte Hersteller und je drei Abfüllungen in den Stufen low, standard und premium.
- Gibt es im Land keine legal vermarktete nationale Spirituose, setze keine_legale_auswahl auf true, lasse producers leer und beschreibe die Rechtslage in den Absätzen.
- Bestehen Einfuhr- oder Verkaufsbeschränkungen für den europäischen Markt, halte sie in notice_de fest.

Ton: sachlich, knapp, keine Werbesprache, keine Kaufempfehlungen. Du schreibst ausschließlich die deutschen Felder; die englische Fassung entsteht später in einem eigenen Übersetzungsschritt.

Erfinde nichts. Was du nicht belegen kannst, lässt du weg und trägst es in unsicherheiten ein. Lieber zwei belegte Hersteller als drei, von denen einer geraten ist.`;

const CACHE_EPHEMERAL = { type: "ephemeral" };

/** Systemprompt als Textblock mit Cache-Breakpoint (TTL 5 Min). */
function systemMitCache(text) {
  return [{ type: "text", text, cache_control: CACHE_EPHEMERAL }];
}

/** Cache-Breakpoint auf dem letzten Tool – cached die gesamte tools-Präfix. */
function toolsMitCache(tools) {
  if (!tools?.length) return tools;
  return tools.map((tool, i) =>
    i === tools.length - 1 ? { ...tool, cache_control: CACHE_EPHEMERAL } : tool
  );
}

/**
 * Dynamische Filterung (Code Execution vor dem Kontextfenster) ab Claude 4.6.
 * Sonnet 4.5 braucht allowed_callers: ["direct"], sonst 400.
 */
function unterstuetztDynamischeFilterung(modell) {
  const m = String(modell || "").toLowerCase();
  if (m.includes("mythos")) return true;
  const treffer = m.match(/claude-(?:opus|sonnet|haiku)-(\d+)-(\d+)/);
  if (!treffer) return false;
  const major = Number(treffer[1]);
  const minor = Number(treffer[2]);
  return major > 4 || (major === 4 && minor >= 6);
}

/** web_search_20260209: dynamische Filterung wo das Modell sie kann; max_uses 8. */
function webSucheWerkzeug(modell) {
  const tool = {
    type: "web_search_20260209",
    name: "web_search",
    max_uses: 8
  };
  if (!unterstuetztDynamischeFilterung(modell)) {
    tool.allowed_callers = ["direct"];
  }
  return tool;
}

/**
 * usage.input_tokens zählt nach Caching nur Tokens hinter dem Breakpoint.
 * Für research_runs speichern wir die Gesamteingabe (Read + Write + Rest),
 * damit bestehende Token-Vergleiche nicht kippen. Cache-Felder zusätzlich loggen.
 */
function usageZusammenfassen(usage) {
  if (!usage) {
    return {
      input_tokens: null,
      output_tokens: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null
    };
  }
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const uncached = usage.input_tokens ?? 0;
  const inputGesamt = uncached + cacheCreation + cacheRead;
  console.log("[anthropic usage]", {
    input_tokens_uncached: uncached,
    input_tokens_gesamt: inputGesamt,
    output_tokens: usage.output_tokens ?? null,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead
  });
  return {
    input_tokens: inputGesamt,
    output_tokens: usage.output_tokens ?? null,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead
  };
}

/** URLs aus web_search_tool_result, inkl. verschachtelter Blöcke (Filterung). */
function urlsAusSuche(bloecke) {
  const urls = [];
  for (const b of bloecke ?? []) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const t of b.content) {
        if (t?.url) urls.push(t.url);
      }
    }
    if (Array.isArray(b.content)) urls.push(...urlsAusSuche(b.content));
  }
  return urls;
}

async function anthropicAufrufen(env, { system, messages, tools, tool_choice, max_tokens, model }) {
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
      model: model || env.ANTHROPIC_MODEL || STANDARD_MODELL,
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
  const modell = env.ANTHROPIC_MODEL || STANDARD_MODELL;
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
    model: modell,
    system: systemMitCache(ANWEISUNG),
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `Recherchiere die landestypische Spirituose für ${country.name_de} (englisch: ${country.name_en}).${bestand}\n\nRufe am Ende das Werkzeug laenderdaten_vorschlagen mit dem vollständigen Ergebnis auf.`
      }
    ],
    tools: toolsMitCache([
      webSucheWerkzeug(modell),
      {
        name: "laenderdaten_vorschlagen",
        description: "Übergibt den fertig recherchierten Länderdatensatz an die Redaktion.",
        input_schema: VORSCHLAG_SCHEMA
      }
    ])
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

  const tokens = usageZusammenfassen(ergebnis.usage);

  return {
    vorschlag: vorschlagBereinigen(aufruf.input),
    besuchteQuellen: [...new Set(urlsAusSuche(ergebnis.content))],
    modell: ergebnis.model,
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    cache_creation_input_tokens: tokens.cache_creation_input_tokens,
    cache_read_input_tokens: tokens.cache_read_input_tokens
  };
}

// Das Modell hält sich meistens, aber nicht immer an das Schema. Einmal kamen
// die Absätze als ein einziger String statt als Liste von Objekten zurück –
// der Admin iterierte dann Zeichen für Zeichen und zeigte tausende leere
// Blöcke. Deshalb wird der Vorschlag hier begradigt, bevor er den Server
// verlässt.
function vorschlagBereinigen(vorschlag) {
  let p = vorschlag?.paragraphs;
  if (typeof p === "string") p = stringZuAbsaetzen(p);
  if (Array.isArray(p)) {
    // Eine Liste: Strings in Objekte verpacken, Leeres aussortieren.
    vorschlag.paragraphs = p
      .map((eintrag) => (typeof eintrag === "string" ? { text_de: eintrag.trim() } : eintrag))
      .filter((eintrag) => eintrag && typeof eintrag === "object" && (eintrag.text_de ?? "").trim());
  } else {
    vorschlag.paragraphs = [];
  }
  return vorschlag;
}

// Ein als String geliefertes paragraphs-Feld in eine Liste verwandeln.
//
// Vorfall 11.08. (Philippinen): Der String war diesmal ein komplettes, hübsch
// formatiertes JSON-Array. Das Teilen an Leerzeilen machte aus jeder
// JSON-Klammer einen eigenen "Absatz" – [, {, "text_de": … und } landeten
// einzeln als Text auf der Seite. Deshalb: erst als JSON lesen, dann notfalls
// die text_de-Werte herausziehen, erst zuletzt stumpf an Leerzeilen teilen.
function stringZuAbsaetzen(text) {
  const roh = text.trim();

  // 1. Sauberes JSON? Dann ist nichts weiter zu tun.
  if (roh.startsWith("[") || roh.startsWith("{")) {
    try {
      const geparst = JSON.parse(roh);
      return Array.isArray(geparst) ? geparst : [geparst];
    } catch {
      // Kein gültiges JSON (bei den Philippinen: unmaskierte Anführungszeichen
      // im Text) – unten weiterversuchen.
    }
  }

  // 2. An Leerzeilen teilen; gab es keine, ersatzweise an Zeilenumbrüchen.
  let teile = roh.split(/\n\s*\n/);
  if (teile.length === 1 && roh.includes("\n")) teile = roh.split("\n");
  teile = teile.map((t) => t.trim()).filter(Boolean);

  // 3. Sind es JSON-Bruchstücke, nur den Inhalt der text_de-Werte behalten.
  if (teile.some((t) => t.includes('"text_de"'))) {
    teile = teile
      .filter((t) => t.includes('"text_de"'))
      .map((t) =>
        t
          .replace(/^.*?"text_de"\s*:\s*"/, "")
          .replace(/"\s*[,}\]\s]*$/, "")
          .replace(/\\"/g, '"')
      );
  }

  // 4. Reine JSON-Zeichen aussortieren, falls doch etwas durchrutscht.
  return teile.filter((t) => !/^[\[\]{}",:\s]*$/.test(t));
}

/**
 * Übersetzt gezielt die deutschen Felder eines Landes ins Englische.
 * Erwartet und liefert eine flache Liste, damit die Zuordnung eindeutig bleibt.
 */
export async function felderUebersetzen(env, felder) {
  const zuUebersetzen = felder.filter((f) => f.de?.trim());
  if (!zuUebersetzen.length) return {};

  const uebersetzSystem =
    "Du übersetzt redaktionelle Texte einer Spirituosen-Übersicht aus dem Deutschen ins Englische. " +
    "Sachlich und knapp, keine Werbesprache. Eigennamen, Marken und Ortsnamen bleiben unverändert. " +
    "Alkoholangaben werden von '53 % Vol.' zu '53% ABV'. Übersetze jeden Eintrag einzeln und gib den Schlüssel unverändert zurück.";

  const ergebnis = await anthropicAufrufen(env, {
    model: env.ANTHROPIC_TRANSLATE_MODEL || STANDARD_UEBERSETZ_MODELL,
    system: systemMitCache(uebersetzSystem),
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
    tools: toolsMitCache([
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
    ]),
    tool_choice: { type: "tool", name: "uebersetzungen_liefern" }
  });

  const aufruf = ergebnis.content?.find((b) => b.type === "tool_use");
  if (!aufruf) throw new Error("Es kamen keine Übersetzungen zurück.");

  // Cache-Usage nur loggen; Übersetzung speichert keine research_runs-Zeile.
  usageZusammenfassen(ergebnis.usage);

  return Object.fromEntries((aufruf.input.uebersetzungen ?? []).map((u) => [u.key, u.en]));
}
