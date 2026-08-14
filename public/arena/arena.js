// Getränke-Quiz der Arena.
//
// Der Worker setzt window.alcofasiaArenaLaender ein: je veröffentlichtem Land
// Name und Getränk in beiden Sprachen. Daraus werden bis zu zehn Fragen der
// Form "Welches Getränk gehört zu <Land>?" mit vier Antworten gebaut. Der
// Bestwert bleibt im Browser (localStorage), wie Sprache und Theme auch.

const daten = window.alcofasiaArenaLaender ?? [];
const ui = window.alcofasiaUi;

const intro = document.querySelector("[data-arena-intro]");
const runde = document.querySelector("[data-arena-runde]");
const ergebnis = document.querySelector("[data-arena-ergebnis]");

const bestwertZeile = document.querySelector("[data-arena-bestwert]");
const hinweis = document.querySelector("[data-arena-hinweis]");
const startKnopf = document.querySelector("[data-arena-start]");

const standRunde = document.querySelector("[data-arena-stand-runde]");
const standPunkte = document.querySelector("[data-arena-stand-punkte]");
const frage = document.querySelector("[data-arena-frage]");
const antwortListe = document.querySelector("[data-arena-antworten]");
const weiterKnopf = document.querySelector("[data-arena-weiter]");

const punktzahl = document.querySelector("[data-arena-punktzahl]");
const wertung = document.querySelector("[data-arena-wertung]");
const endBestwert = document.querySelector("[data-arena-endbestwert]");
const nochmalKnopf = document.querySelector("[data-arena-nochmal]");

const BESTWERT_SCHLUESSEL = "arena-getraenke-bestwert";
const RUNDEN_ZIEL = 10;
const ANTWORTEN_JE_FRAGE = 4;

// Solange es weniger als zehn veröffentlichte Länder gibt, ist eine Partie
// entsprechend kürzer – die Beschriftungen rechnen mit der echten Länge.
const spielLaenge = () => Math.min(RUNDEN_ZIEL, daten.length);

// ------------------------------------------------------------ Hilfsfunktionen

const gemischt = (liste) => {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
};

const englisch = () => ui.getLanguage() === "en";
const landName = (land) => (englisch() ? land.en : land.de);
const getraenkName = (land) => (englisch() ? land.getraenkEn : land.getraenkDe);

const bestwertLesen = () => {
  try {
    const wert = Number.parseInt(localStorage.getItem(BESTWERT_SCHLUESSEL), 10);
    return Number.isFinite(wert) ? wert : null;
  } catch {
    return null; // Ohne Browser-Speicher gibt es einfach keinen Bestwert.
  }
};

const bestwertSchreiben = (wert) => {
  try {
    localStorage.setItem(BESTWERT_SCHLUESSEL, String(wert));
  } catch {
    // Das Spiel funktioniert auch ohne gespeicherten Bestwert.
  }
};

// --------------------------------------------------------------- Spielzustand

let fragen = [];       // [{ land, antworten: [land, …] }] – Antworten sind Länder,
                       // angezeigt wird deren Getränk; richtig ist fragen[i].land.
let aktuelleFrage = 0;
let punkte = 0;
let aufgeloest = false;

// Fragen bauen: Länder mischen, je Frage drei Getränke anderer Länder als
// falsche Antworten dazu. Getränke, die mehrfach vorkommen (etwa Vodka),
// werden je Frage nur einmal angeboten – und nie das richtige Getränk unter
// anderem Namen.
const fragenBauen = () => {
  const reihenfolge = gemischt(daten).slice(0, RUNDEN_ZIEL);

  return reihenfolge.map((land) => {
    const andere = [];
    const gesehen = new Set([land.getraenkDe]);

    for (const kandidat of gemischt(daten)) {
      if (gesehen.has(kandidat.getraenkDe)) continue;
      gesehen.add(kandidat.getraenkDe);
      andere.push(kandidat);
      if (andere.length >= ANTWORTEN_JE_FRAGE - 1) break;
    }

    return { land, antworten: gemischt([land, ...andere]) };
  });
};

// ------------------------------------------------------------------ Ansichten

const zeigeAnsicht = (ansicht) => {
  intro.hidden = ansicht !== intro;
  runde.hidden = ansicht !== runde;
  ergebnis.hidden = ansicht !== ergebnis;
};

const introBeschriften = () => {
  const bestwert = bestwertLesen();
  bestwertZeile.hidden = bestwert == null;

  if (bestwert != null) {
    bestwertZeile.textContent = englisch()
      ? `Best so far: ${bestwert} of ${spielLaenge()}`
      : `Bisheriger Bestwert: ${bestwert} von ${spielLaenge()}`;
  }

  // Ohne genügend Länder für vier verschiedene Getränke gibt es nichts zu
  // raten – dann bleibt nur der Hinweis stehen.
  const genugDaten = new Set(daten.map((l) => l.getraenkDe)).size >= ANTWORTEN_JE_FRAGE;
  hinweis.hidden = genugDaten;
  startKnopf.hidden = !genugDaten;
};

const frageZeigen = () => {
  const { land, antworten } = fragen[aktuelleFrage];
  aufgeloest = false;
  weiterKnopf.hidden = true;

  standRunde.textContent = englisch()
    ? `Round ${aktuelleFrage + 1} of ${fragen.length}`
    : `Runde ${aktuelleFrage + 1} von ${fragen.length}`;
  standPunkte.textContent = englisch() ? `Score ${punkte}` : `Punkte ${punkte}`;

  frage.replaceChildren(
    document.createTextNode(englisch() ? "Which drink belongs to " : "Welches Getränk gehört zu "),
    Object.assign(document.createElement("strong"), { textContent: landName(land) }),
    document.createTextNode("?")
  );

  antwortListe.replaceChildren(
    ...antworten.map((antwort) => {
      const eintrag = document.createElement("li");
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "antwort";
      knopf.textContent = getraenkName(antwort);
      knopf.addEventListener("click", () => aufloesen(knopf, antwort));
      eintrag.append(knopf);
      return eintrag;
    })
  );
};

// Nach dem Klick: richtige Antwort grün, eine falsch gewählte rot. Weiter
// geht es bewusst erst per Knopf, damit man die Auflösung in Ruhe sieht.
const aufloesen = (knopf, antwort) => {
  if (aufgeloest) return;
  aufgeloest = true;

  const { land, antworten } = fragen[aktuelleFrage];
  const richtig = antwort === land;
  if (richtig) punkte += 1;

  const knoepfe = [...antwortListe.querySelectorAll("button")];
  for (const [i, k] of knoepfe.entries()) {
    k.disabled = true;
    if (antworten[i] === land) k.classList.add("richtig");
  }
  if (!richtig) knopf.classList.add("falsch");

  standPunkte.textContent = englisch() ? `Score ${punkte}` : `Punkte ${punkte}`;
  weiterKnopf.hidden = false;
  weiterKnopf.focus();
};

// Merkt sich, ob die letzte Partie einen neuen Bestwert brachte – der
// Sprachwechsel auf der Ergebnisansicht braucht das zum Neubeschriften.
let neuerBestwertZuletzt = false;

const ergebnisBeschriften = () => {
  punktzahl.textContent = `${punkte} / ${fragen.length}`;

  const anteil = punkte / fragen.length;
  wertung.textContent = englisch()
    ? anteil === 1
      ? "Perfect — you know Asia's drinks by heart."
      : anteil >= 0.7
        ? "Impressive — hardly anything gets past you."
        : anteil >= 0.4
          ? "Not bad — the country pages will fill the gaps."
          : "A round through the country pages will fix that."
    : anteil === 1
      ? "Perfekt — du kennst Asiens Getränke auswendig."
      : anteil >= 0.7
        ? "Beachtlich — an dir geht kaum etwas vorbei."
        : anteil >= 0.4
          ? "Nicht schlecht — die Länderseiten füllen die Lücken."
          : "Eine Runde durch die Länderseiten hilft.";

  const bestwert = bestwertLesen();
  endBestwert.textContent = neuerBestwertZuletzt
    ? englisch() ? "New personal best." : "Neuer Bestwert."
    : englisch()
      ? `Best so far: ${bestwert} of ${fragen.length}`
      : `Bisheriger Bestwert: ${bestwert} von ${fragen.length}`;
};

const weiter = () => {
  aktuelleFrage += 1;

  if (aktuelleFrage < fragen.length) {
    frageZeigen();
    return;
  }

  // Spielende: Punktzahl, eine kleine Einordnung und der Bestwert.
  const bisher = bestwertLesen();
  neuerBestwertZuletzt = bisher == null || punkte > bisher;
  if (neuerBestwertZuletzt) bestwertSchreiben(punkte);

  ergebnisBeschriften();
  zeigeAnsicht(ergebnis);
};

const spielStarten = () => {
  fragen = fragenBauen();
  aktuelleFrage = 0;
  punkte = 0;
  zeigeAnsicht(runde);
  frageZeigen();
};

startKnopf.addEventListener("click", spielStarten);
weiterKnopf.addEventListener("click", weiter);
nochmalKnopf.addEventListener("click", spielStarten);

// Sprachwechsel: die statischen Texte übersetzt site-ui.js über data-en,
// die dynamischen (Frage, Antworten, Stand, Ergebnis) werden hier neu
// beschriftet – ohne den Spielstand anzutasten.
window.addEventListener("alcofasia:languagechange", () => {
  introBeschriften();

  if (!runde.hidden && fragen[aktuelleFrage]) {
    const { land, antworten } = fragen[aktuelleFrage];

    standRunde.textContent = englisch()
      ? `Round ${aktuelleFrage + 1} of ${fragen.length}`
      : `Runde ${aktuelleFrage + 1} von ${fragen.length}`;
    standPunkte.textContent = englisch() ? `Score ${punkte}` : `Punkte ${punkte}`;

    frage.replaceChildren(
      document.createTextNode(englisch() ? "Which drink belongs to " : "Welches Getränk gehört zu "),
      Object.assign(document.createElement("strong"), { textContent: landName(land) }),
      document.createTextNode("?")
    );

    for (const [i, k] of antwortListe.querySelectorAll("button").entries()) {
      k.textContent = getraenkName(antworten[i]);
    }
  }

  if (!ergebnis.hidden) {
    ergebnisBeschriften();
  }
});

introBeschriften();
