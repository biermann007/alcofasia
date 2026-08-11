// Datenzugriff. Ein Land wird immer als vollständiger Baum geladen und
// gespeichert, weil die Detailseite ohnehin alles braucht und die Datenmengen
// klein sind (47 Länder, unter 100 KB insgesamt).

const ORDER = "ORDER BY position";

export async function loadCountries(env, { nurGepflegte = false } = {}) {
  const where = nurGepflegte ? "WHERE status = 'veroeffentlicht'" : "";

  const [countries, paragraphs, facts, producers, products, sources] = await Promise.all([
    env.DB.prepare(`SELECT * FROM countries ${where} ORDER BY sort_order, name_de`).all(),
    env.DB.prepare(`SELECT * FROM paragraphs ${ORDER}`).all(),
    env.DB.prepare(`SELECT * FROM facts ${ORDER}`).all(),
    env.DB.prepare(`SELECT * FROM producers ${ORDER}`).all(),
    env.DB.prepare(`SELECT p.* FROM products p JOIN producers pr ON pr.id = p.producer_id ORDER BY pr.position, p.position`).all(),
    env.DB.prepare(`SELECT * FROM sources ${ORDER}`).all()
  ]);

  const byCountry = (rows) => {
    const map = new Map();
    for (const row of rows.results) {
      if (!map.has(row.country_id)) map.set(row.country_id, []);
      map.get(row.country_id).push(row);
    }
    return map;
  };

  const paragraphsBy = byCountry(paragraphs);
  const factsBy = byCountry(facts);
  const producersBy = byCountry(producers);
  const sourcesBy = byCountry(sources);

  const productsBy = new Map();
  for (const row of products.results) {
    if (!productsBy.has(row.producer_id)) productsBy.set(row.producer_id, []);
    productsBy.get(row.producer_id).push(row);
  }

  return countries.results.map((country) => ({
    ...country,
    paragraphs: paragraphsBy.get(country.id) ?? [],
    facts: factsBy.get(country.id) ?? [],
    sources: sourcesBy.get(country.id) ?? [],
    producers: (producersBy.get(country.id) ?? []).map((producer) => ({
      ...producer,
      products: productsBy.get(producer.id) ?? []
    }))
  }));
}

export async function loadCountry(env, slug) {
  const row = await env.DB.prepare("SELECT id FROM countries WHERE slug = ?").bind(slug).first();
  if (!row) return null;
  const all = await loadCountries(env);
  return all.find((c) => c.id === row.id) ?? null;
}

const COUNTRY_FIELDS = [
  "spirit_de", "spirit_en", "subtitle_de", "subtitle_en", "notice_de", "notice_en",
  "glow_rgb", "stroke_hex", "fill_hex", "hover_fill_hex", "dark_fill_hex",
  "dark_hover_hex", "glow_delay", "status", "sort_order", "alkoholverbot"
];

// Speichert ein Land vollständig neu. Kindtabellen werden ersetzt statt
// abgeglichen – bei dieser Datenmenge einfacher und ohne Sortierprobleme.
export async function saveCountry(env, slug, data, benutzer) {
  const country = await env.DB.prepare("SELECT id FROM countries WHERE slug = ?").bind(slug).first();
  if (!country) throw new Error(`Unbekanntes Land: ${slug}`);
  const id = country.id;

  const felder = COUNTRY_FIELDS.filter((f) => f in data);
  const statements = [
    env.DB.prepare(
      `UPDATE countries SET ${felder.map((f) => `${f} = ?`).join(", ")}${felder.length ? "," : ""}
       updated_at = datetime('now'), updated_by = ? WHERE id = ?`
    ).bind(...felder.map((f) => data[f] ?? null), benutzer ?? null, id),

    env.DB.prepare("DELETE FROM paragraphs WHERE country_id = ?").bind(id),
    env.DB.prepare("DELETE FROM facts WHERE country_id = ?").bind(id),
    env.DB.prepare("DELETE FROM sources WHERE country_id = ?").bind(id),
    env.DB.prepare("DELETE FROM producers WHERE country_id = ?").bind(id) // Produkte per ON DELETE CASCADE
  ];

  (data.paragraphs ?? []).forEach((p, i) => {
    if (!p.text_de?.trim()) return;
    statements.push(
      env.DB.prepare("INSERT INTO paragraphs (country_id, position, text_de, text_en) VALUES (?, ?, ?, ?)")
        .bind(id, i, p.text_de.trim(), p.text_en?.trim() || null)
    );
  });

  (data.facts ?? []).forEach((f, i) => {
    if (!f.label_de?.trim() || !f.value_de?.trim()) return;
    statements.push(
      env.DB.prepare("INSERT INTO facts (country_id, position, label_de, label_en, value_de, value_en) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, i, f.label_de.trim(), f.label_en?.trim() || null, f.value_de.trim(), f.value_en?.trim() || null)
    );
  });

  (data.sources ?? []).forEach((s, i) => {
    if (!s.url?.trim()) return;
    statements.push(
      env.DB.prepare("INSERT INTO sources (country_id, position, title, url) VALUES (?, ?, ?, ?)")
        .bind(id, i, s.title?.trim() || s.url.trim(), s.url.trim())
    );
  });

  await env.DB.batch(statements);

  // Hersteller und Produkte brauchen die erzeugten IDs, daher ein zweiter Durchgang.
  for (const [i, producer] of (data.producers ?? []).entries()) {
    const hatProdukte = (producer.products ?? []).some((p) => p.name?.trim());
    if (!producer.name?.trim() && !hatProdukte) continue;

    const eingefuegt = await env.DB.prepare(
      `INSERT INTO producers (country_id, position, name, label_de, label_en, origin_de, origin_en)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(
      id,
      producer.position ?? i + 1,
      producer.name?.trim() || null,
      producer.label_de?.trim() || null,
      producer.label_en?.trim() || null,
      producer.origin_de?.trim() || null,
      producer.origin_en?.trim() || null
    ).first();

    const produktStatements = (producer.products ?? [])
      .filter((p) => p.name?.trim())
      .map((p, j) =>
        env.DB.prepare(
          `INSERT INTO products (producer_id, position, tier, tier_label_de, tier_label_en, tier_list_de, tier_list_en, name,
             meta_de, meta_en, description_de, description_en, availability_de, availability_en,
             category_de, category_en, ingredients_de, ingredients_en, abv_de, abv_en,
             positioning_de, positioning_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          eingefuegt.id, j, p.tier ?? "low",
          p.tier_label_de?.trim() || null, p.tier_label_en?.trim() || null,
          p.tier_list_de?.trim() || null, p.tier_list_en?.trim() || null,
          p.name.trim(),
          p.meta_de?.trim() || null, p.meta_en?.trim() || null,
          p.description_de?.trim() || null, p.description_en?.trim() || null,
          p.availability_de?.trim() || null, p.availability_en?.trim() || null,
          p.category_de?.trim() || null, p.category_en?.trim() || null,
          p.ingredients_de?.trim() || null, p.ingredients_en?.trim() || null,
          p.abv_de?.trim() || null, p.abv_en?.trim() || null,
          p.positioning_de?.trim() || null, p.positioning_en?.trim() || null
        )
      );

    if (produktStatements.length) await env.DB.batch(produktStatements);
  }
}

// ------------------------------------------------------------- Buddha-Seite
//
// Zwei frei bearbeitbare Textbereiche ("top3" und "empfehlung"), gepflegt
// unter /admin/buddha. Rückgabe als Objekt: { top3: {…}, empfehlung: {…} }.

export async function loadBuddhaTexte(env) {
  const { results } = await env.DB.prepare("SELECT * FROM buddha_texte").all();
  return Object.fromEntries(results.map((zeile) => [zeile.key, zeile]));
}

export async function saveBuddhaTexte(env, daten, benutzer) {
  const statements = [];
  for (const key of ["top3", "empfehlung"]) {
    if (!(key in daten)) continue;
    const eintrag = daten[key] ?? {};
    statements.push(
      env.DB.prepare(
        `INSERT INTO buddha_texte (key, text_de, text_en, updated_at, updated_by)
         VALUES (?, ?, ?, datetime('now'), ?)
         ON CONFLICT(key) DO UPDATE SET
           text_de = excluded.text_de, text_en = excluded.text_en,
           updated_at = excluded.updated_at, updated_by = excluded.updated_by`
      ).bind(key, eintrag.text_de?.trim() || null, eintrag.text_en?.trim() || null, benutzer ?? null)
    );
  }
  if (statements.length) await env.DB.batch(statements);
}

export async function protokolliereRecherche(env, countryId, eintrag) {
  const row = await env.DB.prepare(
    `INSERT INTO research_runs (country_id, created_by, model, status, proposal, error, input_tokens, output_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(
    countryId,
    eintrag.benutzer ?? null,
    eintrag.model ?? null,
    eintrag.status ?? "offen",
    eintrag.proposal ? JSON.stringify(eintrag.proposal) : null,
    eintrag.error ?? null,
    eintrag.input_tokens ?? null,
    eintrag.output_tokens ?? null
  ).first();
  return row.id;
}
