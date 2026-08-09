-- alcofasia · Datenmodell für den Adminbereich
--
-- Ein Land trägt seine Stammdaten, beliebig viele Fließtext-Absätze, eine frei
-- benennbare Faktenliste, beliebig viele Hersteller mit je bis zu drei
-- Produktstufen und eine Quellenliste.
--
-- Jedes redaktionelle Feld existiert zweimal: _de und _en. Das ersetzt das
-- Wörterbuch in site-ui.js, das bisher bei jedem neuen Land mitgepflegt
-- werden musste.

-- Ohne PRAGMA-Zeile: D1 verwaltet Fremdschlüssel selbst und weist den Befehl zurück.

CREATE TABLE countries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT    NOT NULL UNIQUE,

  -- name_de muss exakt dem data-country-Attribut in asia.svg entsprechen,
  -- sonst findet die Karte das Land nicht. Wird beim Import geprüft.
  name_de         TEXT    NOT NULL UNIQUE,
  name_en         TEXT    NOT NULL,

  status          TEXT    NOT NULL DEFAULT 'leer'
                          CHECK (status IN ('leer', 'entwurf', 'veroeffentlicht')),

  -- Reihenfolge auf der Listenseite. Die bisherige Reihenfolge war die des
  -- Hinzufügens, nicht das Alphabet – das bleibt so und ist im Admin änderbar.
  sort_order      INTEGER NOT NULL DEFAULT 100,

  -- Überschrift der Detailseite, z. B. "Baijiu" oder "Keine legale Spirituose"
  spirit_de       TEXT,
  spirit_en       TEXT,
  subtitle_de     TEXT,
  subtitle_en     TEXT,

  -- Im Land ist Alkohol verboten. Steuert die rote Darstellung im Laufband
  -- über der Karte.
  alkoholverbot   INTEGER NOT NULL DEFAULT 0,

  -- Abschließender Hinweiskasten, z. B. das EU-Einfuhrverbot bei Russland
  notice_de       TEXT,
  notice_en       TEXT,

  -- Farbwelt des Landes auf der Karte, bisher fest im CSS von index.html
  glow_rgb        TEXT,
  stroke_hex      TEXT,
  fill_hex        TEXT,
  hover_fill_hex  TEXT,
  dark_fill_hex   TEXT,
  dark_hover_hex  TEXT,
  glow_delay      TEXT,

  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_by      TEXT
);

CREATE TABLE paragraphs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  text_de     TEXT    NOT NULL,
  text_en     TEXT
);

-- Die Definitionsliste unter dem Fließtext. Bewusst frei benennbar, weil die
-- Zeilen je Land abweichen: China hat "Aromastil", Afghanistan "Status".
CREATE TABLE facts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  label_de    TEXT    NOT NULL,
  label_en    TEXT,
  value_de    TEXT    NOT NULL,
  value_en    TEXT
);

-- position 0 mit name IS NULL bildet den Fall "kein Hersteller" ab
-- (Afghanistan: eine einzelne Produktkarte ohne Herstellerüberschrift).
CREATE TABLE producers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT,
  label_de    TEXT,
  label_en    TEXT,
  origin_de   TEXT,
  origin_en   TEXT
);

CREATE TABLE products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  producer_id     INTEGER NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,

  -- 'keine' deckt die Platzhalterkarte ohne Produktauswahl ab
  tier            TEXT    NOT NULL DEFAULT 'low'
                          CHECK (tier IN ('low', 'standard', 'premium', 'keine')),
  tier_label_de   TEXT,
  tier_label_en   TEXT,

  -- Die Listenseite beschriftet die Stufe teils anders als die Detailkarte
  -- (Afghanistan: "Nicht verfügbar" statt "Keine Kategorie"). Leer heißt:
  -- dieselbe Beschriftung wie auf der Karte.
  tier_list_de    TEXT,
  tier_list_en    TEXT,

  name            TEXT    NOT NULL,
  meta_de         TEXT,
  meta_en         TEXT,
  description_de  TEXT,
  description_en  TEXT,
  availability_de TEXT,
  availability_en TEXT,

  -- Spalten, die heute nur auf der Listenseite gepflegt werden
  category_de     TEXT,
  category_en     TEXT,
  ingredients_de  TEXT,
  ingredients_en  TEXT,
  abv_de          TEXT,
  abv_en          TEXT,
  positioning_de  TEXT,
  positioning_en  TEXT
);

CREATE TABLE sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id  INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  checked_at  TEXT
);

-- Protokoll der Recherchelaeufe: was Claude vorgeschlagen hat und was daraus
-- wurde. Dient als Nachweis und erlaubt, einen Vorschlag später erneut zu öffnen.
CREATE TABLE research_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id    INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_by    TEXT,
  model         TEXT,
  status        TEXT    NOT NULL DEFAULT 'offen'
                        CHECK (status IN ('offen', 'uebernommen', 'verworfen', 'fehler')),
  proposal      TEXT,
  error         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER
);

CREATE INDEX idx_paragraphs_country ON paragraphs(country_id, position);
CREATE INDEX idx_facts_country      ON facts(country_id, position);
CREATE INDEX idx_producers_country  ON producers(country_id, position);
CREATE INDEX idx_products_producer  ON products(producer_id, position);
CREATE INDEX idx_sources_country    ON sources(country_id, position);
CREATE INDEX idx_research_country   ON research_runs(country_id, created_at DESC);
CREATE INDEX idx_countries_status   ON countries(status);
