-- Seitenweite Einstellungen, gepflegt im Adminbereich unter /admin/einstellungen.
--
-- Erster Eintrag: produkte_anzeigen. Er entscheidet, ob die Hersteller- und
-- Produktkarten in der Länderansicht und die Produkttabelle unter /list
-- ausgegeben werden. Redaktionelle Texte, Fakten, Quellen, Karte, Buddha-Seite
-- und Arena bleiben davon unberührt.
--
-- '1' ist der bisherige Zustand: Produkte werden angezeigt. Die Zeile wird hier
-- bewusst mit '1' angelegt, damit das Einspielen der Migration im laufenden
-- Betrieb nichts an der Seite verändert. Fehlt die Tabelle (Migration noch
-- nicht eingespielt), nimmt der Worker ebenfalls '1' an.
--
-- Einspielen: npx wrangler d1 execute alcofasia --remote --file=./migrations/0005_einstellungen.sql

CREATE TABLE einstellungen (
  key        TEXT PRIMARY KEY,
  wert       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

INSERT INTO einstellungen (key, wert) VALUES ('produkte_anzeigen', '1');
