// Kleiner Zwischenspeicher je Isolate. Redaktionelle Änderungen sind selten,
// Seitenaufrufe häufig – eine halbe Minute Verzögerung ist vertretbar, und der
// Admin leert den Speicher beim Speichern ohnehin.
//
// Eigenes Modul, damit sich Worker und Adminbereich nicht gegenseitig
// importieren müssen.

import { loadCountries } from "./db.js";

const CACHE_MS = 30_000;
let cache = { zeit: 0, daten: null };

export function cacheLeeren() {
  cache = { zeit: 0, daten: null };
}

export async function laenderMitCache(env) {
  const jetzt = Date.now();
  if (cache.daten && jetzt - cache.zeit < CACHE_MS) return cache.daten;
  const daten = await loadCountries(env);
  cache = { zeit: jetzt, daten };
  return daten;
}

/**
 * Wie laenderMitCache, aber ohne die Seite mitzureißen, wenn die Datenbank
 * nicht erreichbar ist – etwa weil beim Deploy noch keine D1-Datenbank
 * angelegt oder die Migration noch nicht eingespielt wurde.
 *
 * In dem Fall wird die statische Seite unverändert ausgeliefert: Karte, Layout
 * und Bedienung stehen, nur die Länderinhalte fehlen. Das ist deutlich besser
 * als ein Fehler auf jeder Anfrage.
 */
export async function laenderOderLeer(env) {
  try {
    return { laender: await laenderMitCache(env), fehler: null };
  } catch (fehler) {
    console.error("Länder konnten nicht geladen werden:", fehler);
    return { laender: [], fehler: String(fehler?.message ?? fehler) };
  }
}
