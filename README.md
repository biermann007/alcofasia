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

## Veröffentlichung

Änderungen auf `main` werden über Cloudflare Workers Builds automatisch auf
[alcofasia.com](https://alcofasia.com) veröffentlicht. Redaktionelle Änderungen
im Adminbereich brauchen keinen Deploy.
