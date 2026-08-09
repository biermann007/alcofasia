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
