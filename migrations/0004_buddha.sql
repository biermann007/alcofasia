-- Buddha-Seite: zwei frei bearbeitbare Textbereiche ("Top 3" und "Empfehlung").
--
-- Die Texte werden im Adminbereich unter /admin/buddha gepflegt und vom Worker
-- in public/buddha/index.html eingesetzt. Absätze werden durch Leerzeilen
-- getrennt eingegeben und beim Rendern zu <p>-Elementen.
--
-- Einspielen: npx wrangler d1 execute alcofasia --remote --file=./migrations/0004_buddha.sql

CREATE TABLE buddha_texte (
  key        TEXT PRIMARY KEY CHECK (key IN ('top3', 'empfehlung')),
  text_de    TEXT,
  text_en    TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

INSERT INTO buddha_texte (key) VALUES ('top3'), ('empfehlung');
