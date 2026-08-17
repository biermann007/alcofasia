// Lokaler Stellvertreter für den Worker – zum Prüfen ohne Cloudflare-Konto.
//
// Bildet die beiden Bindings nach, die der Worker braucht: DB (D1 über eine
// SQLite-Datei) und ASSETS (das Verzeichnis public/). HTMLRewriter gibt es hier
// nicht, deshalb wird der Platzhalter mit derselben Ersetzung per Zeichenkette
// gefüllt. Für die Produktion gilt weiterhin `wrangler dev` bzw. `deploy`.
//
// Aufruf: node scripts/dev-server.mjs [port]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { extname, join, normalize } from "node:path";
import {
  renderCountryDetails,
  renderCountryColors,
  renderCountryNames,
  renderListHead,
  renderListRows
} from "../src/render.js";
import { loadCountries, loadCountry, saveCountry } from "../src/db.js";
// Denselben Weg nehmen wie der Worker: einstellungenOderStandard fängt eine
// fehlende Tabelle ab. Sonst verhielte sich der Prüfserver strenger als die
// Produktion und würde einen Fehler zeigen, den es dort nicht gibt.
import { einstellungenOderStandard } from "../src/cache.js";

const port = Number(process.argv[2] ?? 8100);
const root = new URL("../", import.meta.url).pathname;
const oeffentlich = join(root, "public");

// ------------------------------------------------------- D1 über node:sqlite

const datei = process.env.DEV_DB ?? ":memory:";
const sqlite = new DatabaseSync(datei);
// 0003 fehlt bewusst: die dort ergänzte Spalte steht inzwischen schon in
// 0001_init.sql, ein zweiter Durchgang würde daran scheitern.
for (const migration of ["0001_init.sql", "0002_seed.sql", "0004_buddha.sql",
                         "0005_einstellungen.sql", "0006_produkte_je_land.sql"]) {
  sqlite.exec(await readFile(join(root, "migrations", migration), "utf8"));
}

const d1Statement = (sql) => {
  let werte = [];
  const api = {
    bind(...args) {
      werte = args;
      return api;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...werte) };
    },
    async first() {
      return sqlite.prepare(sql).get(...werte) ?? null;
    },
    async run() {
      return sqlite.prepare(sql).run(...werte);
    }
  };
  return api;
};

const env = {
  DB: {
    prepare: d1Statement,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const ergebnis = [];
        for (const s of statements) ergebnis.push(await s.run());
        sqlite.exec("COMMIT");
        return ergebnis;
      } catch (fehler) {
        sqlite.exec("ROLLBACK");
        throw fehler;
      }
    }
  }
};

// ------------------------------------------------------------------- Server

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const einsetzen = (html, platzhalter, inhalt) => {
  // <tag ... data-x></tag> oder <tag ... data-x>alt</tag>
  const muster = new RegExp(`(<([a-z]+)[^>]*\\b${platzhalter}\\b[^>]*>)([\\s\\S]*?)(</\\2>)`, "i");
  if (!muster.test(html)) throw new Error(`Platzhalter ${platzhalter} nicht gefunden`);
  return html.replace(muster, (_, auf, __, ___, zu) => `${auf}${inhalt}${zu}`);
};

createServer(async (anfrage, antwort) => {
  try {
    const url = new URL(anfrage.url, `http://localhost:${port}`);
    let pfad = decodeURIComponent(url.pathname);

    if (pfad === "/" || pfad === "/index.html") {
      const alle = await loadCountries(env);
      const optionen = { produkteAnzeigen: (await einstellungenOderStandard(env)).einstellungen.produkte_anzeigen };
      let html = await readFile(join(oeffentlich, "index.html"), "utf8");
      html = einsetzen(html, "data-country-details", renderCountryDetails(alle, optionen));
      html = einsetzen(html, "data-country-colors", renderCountryColors(alle));
      html = einsetzen(html, "data-country-names", renderCountryNames(alle));
      antwort.writeHead(200, { "content-type": TYPEN[".html"] }).end(html);
      return;
    }

    if (pfad === "/list" || pfad === "/list/" || pfad === "/list/index.html") {
      const alle = await loadCountries(env);
      const optionen = { produkteAnzeigen: (await einstellungenOderStandard(env)).einstellungen.produkte_anzeigen };
      let html = await readFile(join(oeffentlich, "list/index.html"), "utf8");
      html = einsetzen(html, "data-list-head", renderListHead(optionen, alle));
      html = einsetzen(html, "data-list-rows", renderListRows(alle, optionen));
      html = einsetzen(html, "data-country-names", renderCountryNames(alle));
      antwort.writeHead(200, { "content-type": TYPEN[".html"] }).end(html);
      return;
    }

    // Adminbereich ohne Access – nur lokal, deshalb ein fester Testbenutzer.
    if (pfad === "/admin" || pfad.startsWith("/admin/")) {
      const { handleAdmin } = await import("../src/admin.js");
      // Der Prüfserver umgeht Cloudflare Access bewusst – er ist nur an
      // 127.0.0.1 gebunden und wird nie ausgeliefert.
      const koerper =
        anfrage.method === "POST"
          ? await new Promise((fertig) => {
              let daten = "";
              anfrage.on("data", (t) => (daten += t));
              anfrage.on("end", () => fertig(daten));
            })
          : undefined;

      const antwortWorker = await handleAdmin(
        new Request(url, { method: anfrage.method, headers: { "content-type": "application/json" }, body: koerper }),
        env,
        { pruefeAnmeldung: async () => "pruefserver@lokal" }
      );
      antwort.writeHead(antwortWorker.status, Object.fromEntries(antwortWorker.headers));
      antwort.end(await antwortWorker.text());
      return;
    }

    const datei = normalize(join(oeffentlich, pfad));
    if (!datei.startsWith(oeffentlich)) {
      antwort.writeHead(403).end("verboten");
      return;
    }
    const inhalt = await readFile(datei);
    antwort.writeHead(200, { "content-type": TYPEN[extname(datei)] ?? "application/octet-stream" }).end(inhalt);
  } catch (fehler) {
    antwort.writeHead(fehler.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain; charset=utf-8" });
    antwort.end(String(fehler.stack ?? fehler));
  }
}).listen(port, () => console.log(`Prüfserver läuft auf http://127.0.0.1:${port}`));

export { env, loadCountry, saveCountry };
