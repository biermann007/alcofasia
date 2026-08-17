-- Produkte je Land ein- oder ausblenden.
--
-- Bisher entschied nur der seitenweite Schalter aus 0005_einstellungen.sql.
-- Jetzt trägt jedes Land sein eigenes Merkmal: China kann Produkte zeigen,
-- Zypern nicht. Der seitenweite Schalter bleibt als Not-Aus darüber liegen –
-- steht er auf "aus", sind Produkte überall weg, egal was hier steht.
--
-- Der Standard 1 ist der bisherige Zustand: alle Länder zeigen ihre Produkte.
-- Das Einspielen verändert die Seite also nicht. Fehlt die Spalte noch, nimmt
-- der Worker ebenfalls 1 an.
--
-- Nichts wird gelöscht: Hersteller und Produkte bleiben unberührt in ihren
-- Tabellen und kommen beim Wiedereinschalten vollständig zurück.
--
-- Einspielen (der --file-Weg scheitert an der OAuth-Anmeldung, daher als Befehl):
--   npx wrangler d1 execute alcofasia --remote --command "ALTER TABLE countries ADD COLUMN produkte_anzeigen INTEGER NOT NULL DEFAULT 1;"

ALTER TABLE countries ADD COLUMN produkte_anzeigen INTEGER NOT NULL DEFAULT 1;
