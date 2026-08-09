-- Kennzeichnet Länder, in denen Alkohol verboten ist.
--
-- Bisher stand das nur im Fließtext und in der Faktenzeile "Status". Für das
-- Laufband über der Karte braucht es ein eigenes Merkmal, weil diese Länder
-- dort rot erscheinen.
--
-- Einspielen mit:
--   npx wrangler d1 execute alcofasia --remote --file=./migrations/0003_alkoholverbot.sql

ALTER TABLE countries ADD COLUMN alkoholverbot INTEGER NOT NULL DEFAULT 0;

-- Bestandsdaten: Länder, deren Faktenliste ein Alkoholverbot ausweist.
UPDATE countries
SET alkoholverbot = 1
WHERE id IN (
  SELECT country_id FROM facts WHERE value_de LIKE '%Alkoholverbot%'
);
