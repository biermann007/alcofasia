# alcofasia.com

Minimalistische Landingpage mit einer stilisierten Vektorkarte von Asien und
einer Übersicht der landestypischen Spirituosen. Die Inhalte werden im
Adminbereich unter `/admin` gepflegt und liegen in einer Cloudflare-D1-Datenbank.

## Aufbau

```
public/            statische Dateien – Layout, CSS, Karte, Bedienung
  index.html       Startseite mit Karte; die Länderinhalte setzt der Worker ein
  list/index.html  Tabellenansicht; Kopf und Zeilen setzt der Worker ein
  asia.svg         aus world-atlas erzeugte Karte, 47 Länder
src/               Cloudflare Worker
  index.js         Wegweiser, setzt die Inhalte in die statischen Seiten ein
  render.js        erzeugt das HTML der Detailseiten und der Tabelle
  db.js            Lesen und Schreiben in D1
  admin.js         Adminbereich unter /admin
  access.js        Prüfung der Cloudflare-Access-Anmeldung
  research.js      Recherche und Übersetzung über die Anthropic-API
migrations/        Datenbankschema und Startdatensatz
scripts/           Hilfsskripte, siehe unten
```

Die Seiten in `public/` bleiben die Quelle für Layout und Bedienung. Der Worker
ersetzt nur den Inhalt weniger Platzhalter: `data-country-details`,
`data-country-colors`, `data-country-names`, `data-list-head` und
`data-list-rows`.

Zweisprachigkeit läuft über `data-en` direkt am Element. Fehlt das Attribut, ist
der Text in beiden Sprachen gleich. Das frühere Wörterbuch in `site-ui.js`
entfällt damit.

## Einrichtung

Vorausgesetzt wird ein Cloudflare-Konto mit der Domain alcofasia.com sowie
ein Anthropic-API-Schlüssel für die Recherche.

```sh
npm install

# 1. Datenbank anlegen und die ausgegebene ID in wrangler.jsonc eintragen
npx wrangler d1 create alcofasia

# 2. Schema und Startdatensatz einspielen
npm run db:init
npm run db:seed

# 3. Schlüssel für die Recherche hinterlegen
npx wrangler secret put ANTHROPIC_API_KEY

# 4. Veröffentlichen
npm run deploy
```

### Adminbereich absichern

Der Adminbereich ist erst nutzbar, wenn Cloudflare Access davor liegt. Ohne die
beiden Werte antwortet `/admin` mit einer Fehlermeldung statt mit Inhalten.

1. Im Cloudflare-Dashboard unter Zero Trust → Access → Applications eine
   Anwendung vom Typ „Self-hosted" anlegen, Pfad `alcofasia.com/admin`.
2. Als Richtlinie die eigene E-Mail-Adresse erlauben.
3. Aus der Anwendung die *Application Audience Tag* kopieren und zusammen mit
   der Team-Domain in `wrangler.jsonc` unter `vars` eintragen:

```jsonc
"ACCESS_TEAM_DOMAIN": "meinteam.cloudflareaccess.com",
"ACCESS_AUD": "…"
```

Der Worker prüft den von Access ausgestellten Token zusätzlich selbst nach:
Signatur, Ablauf, Zielgruppe und Aussteller. Eine versehentlich zu weit gefasste
Access-Regel öffnet den Adminbereich dadurch nicht automatisch.

## Arbeiten am Projekt

```sh
npm run build:map     # asia.svg aus world-atlas neu erzeugen
npm run dev           # wrangler dev, mit lokaler D1-Kopie
npm run check         # Deploy trocken prüfen
```

Für einen schnellen Blick ohne Cloudflare-Konto gibt es einen Prüfserver, der
D1 durch eine SQLite-Datei ersetzt und Cloudflare Access überspringt. Er bindet
nur an 127.0.0.1 und wird nie ausgeliefert:

```sh
node scripts/dev-server.mjs 8100
```

### Hilfsskripte

| Skript | Zweck |
| --- | --- |
| `scripts/build-map.mjs` | erzeugt `public/asia.svg` aus world-atlas |
| `scripts/extract-content.mjs` | einmalige Migration: liest die früher von Hand gepflegten Inhalte und schreibt `content/seed.json` und `migrations/0002_seed.sql` |
| `scripts/strip-static-content.mjs` | einmalige Umstellung: ersetzt die Inhalte in den statischen Seiten durch Platzhalter |
| `scripts/verify-render.mjs` | vergleicht das gerenderte HTML mit dem Stand vor der Umstellung |
| `scripts/dev-server.mjs` | lokaler Stellvertreter für den Worker |

Die beiden einmaligen Skripte sind bereits gelaufen. Sie bleiben im Projekt,
weil sie nachvollziehbar machen, wie die Inhalte in die Datenbank gekommen sind.

## Adminbereich

`/admin` listet alle 47 Länder der Karte mit ihrem Status. Ein Land hat drei
Zustände: `leer` (nicht auf der Karte hervorgehoben), `entwurf` (nur im Admin
sichtbar) und `veroeffentlicht` (auf der Seite sichtbar).

Auf der Bearbeitungsseite steht links immer Deutsch, rechts Englisch. Der
Ländername lässt sich nicht ändern, weil er zum `data-country`-Attribut in
`asia.svg` passen muss.

**Recherchieren** lässt Claude mit Websuche einen vollständigen Datensatz
vorschlagen: Spirituose, Fließtext, Faktenliste, bis zu drei Hersteller mit je
drei Stufen, rechtliche Hinweise und Quellen, deutsch und englisch. Der
Vorschlag wird dem aktuellen Stand gegenübergestellt und erst auf Klick ins
Formular übernommen; gespeichert wird nichts, bevor du auf Speichern drückst.
Angaben, die nicht belegt werden konnten, führt der Vorschlag getrennt auf.
Jeder Lauf wird in `research_runs` protokolliert.

**Englisch ergänzen** übersetzt alle deutschen Felder, für die noch keine
englische Fassung vorliegt. Auch das landet nur im Formular.

Änderungen erscheinen auf der Seite innerhalb einer halben Minute; so lange hält
der Worker die Daten im Zwischenspeicher.

### Produkte anzeigen

Ob Produkte öffentlich erscheinen, hängt an zwei Haken, und **beide** müssen
gesetzt sein:

| Haken | Wo | Wirkung |
| --- | --- | --- |
| **Produkte dieses Landes anbieten** | auf der Länderseite `/admin/land/<slug>` | entscheidet für dieses eine Land |
| **Produkte auf der Seite anbieten** | `/admin/einstellungen` | Not-Aus über allem: aus heißt überall aus |

Damit lässt sich China mit Produkten und Zypern ohne Produkte zeigen. Fehlt der
Haken, entfallen für das betroffene Land die Hersteller- und Produktkarten in
der Länderansicht und seine Zeilen in der Tabelle unter `/list`. Fließtext,
Faktenliste, rechtliche Hinweise, Quellen, Farbe auf der Karte, Buddha-Seite und
Arena bleiben unverändert. Zeigt kein einziges Land mehr Produkte, steht unter
`/list` nur der Hinweis „Produkte werden zurzeit nicht angezeigt".

Gelöscht wird nie etwas: Hersteller und Produkte bleiben in der Datenbank und im
Admin bearbeitbar und kommen beim Wiedereinschalten vollständig zurück. Die
Übersicht zeigt in der Spalte „Produkte" ein `aus` bei jedem ausgeblendeten Land
und zählt sie in der Kopfzeile.

Das Ausblenden verlangt eine ausdrückliche Bestätigung. Sie wird nicht nur im
Formular abgefragt: Die Schnittstelle `POST /admin/api/einstellungen` weist ein
Ausschalten ohne `bestaetigt: true` mit Status 400 zurück. Einschalten geht ohne
Rückfrage.

Der seitenweite Schalter steht in der Tabelle `einstellungen` (Migration
`0005_einstellungen.sql`), der Haken je Land in der Spalte
`countries.produkte_anzeigen` (Migration `0006_produkte_je_land.sql`).

Fehlt die Tabelle, die Spalte oder ein Eintrag, nimmt der Worker „Produkte
anzeigen" an, und beim Speichern eines Landes wird ein noch fehlendes Feld
stillschweigend übersprungen. Migration und Deploy können deshalb in beliebiger
Reihenfolge passieren, ohne dass die Seite dazwischen anders aussieht oder die
Redaktion blockiert ist.

Einspielen als Befehl – der `--file`-Weg scheitert an der OAuth-Anmeldung
(`Authentication error [code: 10000]`, betrifft nur die Import-Schnittstelle):

```sh
npx wrangler d1 execute alcofasia --remote --command "ALTER TABLE countries ADD COLUMN produkte_anzeigen INTEGER NOT NULL DEFAULT 1;"
```

## alcofworld.com

Die Weltseite (`public/world/`) läuft über denselben Worker: `src/index.js`
erkennt den Hostnamen und liefert für alcofworld.com die Kontinentkarte aus.
Asien ist in Antikgold hervorgehoben und führt auf alcofasia.com; die übrigen
Kontinente zeigen vorerst nur ihren Namen. Die Weltkugel neben dem Buddha auf
der Startseite führt hin.

Die Karte erzeugt `npm run build:world` (`scripts/build-world-map.mjs`) aus
world-atlas nach `public/world.svg` – gleiche Optik wie die Asien-Karte, aber
Natural-Earth-Projektion statt Mercator (Mercator würde die Polregionen einer
ganzen Weltkarte grotesk aufblasen). Welche Länder zu Asien zählen, bestimmt
dieselbe Liste wie in `build-map.mjs`, damit sich Asien mit den 47 Ländern von
alcofasia.com deckt; die übrigen Länder ordnet `world-countries` ihrem Erdteil
zu. Beide Listen bei Änderungen gemeinsam pflegen.

alcofworld.com ist in `wrangler.jsonc` als Custom Domain eingetragen –
Cloudflare legt die DNS-Einträge beim Deploy selbst an. `/admin` leitet von
dort auf alcofasia.com um, denn nur davor liegt Cloudflare Access.

## Veröffentlichung

Änderungen auf `main` werden über Cloudflare Workers Builds automatisch auf
[alcofasia.com](https://alcofasia.com) veröffentlicht. Redaktionelle Änderungen
im Adminbereich brauchen keinen Deploy.
