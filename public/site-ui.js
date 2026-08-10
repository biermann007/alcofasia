// Sprache, Hell-Dunkel-Umschaltung und Tiefe-Schalter.
//
// Die englischen Fassungen stehen nicht mehr in einem Wörterbuch, sondern als
// data-en-Attribut direkt am jeweiligen Element. Der Worker setzt sie beim
// Ausliefern aus der Datenbank ein. Fehlt das Attribut, ist der Text in beiden
// Sprachen gleich.

const root = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeControl = document.querySelector("[data-theme-control]");
const tiefeControl = document.querySelector("[data-tiefe-control]");
const languageControls = document.querySelectorAll("[data-language]");
const controlsLabel = document.querySelector(".site-controls");

// Deutsch -> Englisch für die Ländernamen auf der Karte. Kommt vom Worker;
// der Rückfallwert hält die Seite auch dann bedienbar, wenn er fehlt.
const countryNames = window.alcofasiaCountryNames ?? {};

// Alles, was zwei Sprachfassungen hat, trägt data-en. Der deutsche Text wird
// beim Laden festgehalten, damit das Zurückschalten verlustfrei bleibt.
const translatableElements = [...document.querySelectorAll("[data-en]")];

for (const element of translatableElements) {
  element.dataset.deText = element.textContent.trim();
}

let language = "de";

const countryLabel = (country) => (language === "en" ? countryNames[country] || country : country);

const updateTiefeLabel = () => {
  if (!tiefeControl) {
    return;
  }

  const an = root.dataset.tiefe === "an";
  tiefeControl.textContent =
    language === "en" ? (an ? "Depth: on" : "Depth: off") : an ? "Tiefe: an" : "Tiefe: aus";
  tiefeControl.setAttribute("aria-pressed", String(an));
};

const applyTiefe = (tiefe) => {
  root.dataset.tiefe = tiefe === "aus" ? "aus" : "an";
  updateTiefeLabel();
};

const updateThemeLabel = () => {
  if (!themeControl) {
    return;
  }

  const label = language === "en" ? "Switch light/dark mode" : "Hell-Dunkel-Modus wechseln";
  themeControl.setAttribute("aria-label", label);
  themeControl.title = label;
};

const applyTheme = (theme) => {
  const isDark = theme === "dark";
  root.dataset.theme = isDark ? "dark" : "light";
  themeControl?.setAttribute("aria-pressed", String(isDark));

  if (themeColor) {
    themeColor.content = isDark ? "#000000" : "#ffffff";
  }
};

const applyLanguage = (nextLanguage) => {
  language = nextLanguage === "en" ? "en" : "de";
  root.lang = language;

  for (const control of languageControls) {
    control.setAttribute("aria-pressed", String(control.dataset.language === language));
  }

  controlsLabel?.setAttribute(
    "aria-label",
    language === "en"
      ? controlsLabel.dataset.enLabel || "Language and appearance"
      : "Sprache und Darstellung"
  );

  for (const element of translatableElements) {
    element.textContent = language === "en" ? element.dataset.en : element.dataset.deText;
  }

  updateThemeLabel();
  updateTiefeLabel();
  window.dispatchEvent(new CustomEvent("alcofasia:languagechange", { detail: { language } }));
};

for (const control of languageControls) {
  control.addEventListener("click", () => {
    applyLanguage(control.dataset.language);

    try {
      localStorage.setItem("language", language);
    } catch {
      // The language control still works when browser storage is unavailable.
    }
  });
}

themeControl?.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);

  try {
    localStorage.setItem("theme", theme);
  } catch {
    // The theme control still works when browser storage is unavailable.
  }
});

tiefeControl?.addEventListener("click", () => {
  const tiefe = root.dataset.tiefe === "an" ? "aus" : "an";
  applyTiefe(tiefe);

  try {
    localStorage.setItem("tiefe", tiefe);
  } catch {
    // The depth control still works when browser storage is unavailable.
  }
});

let initialTheme = "light";
let initialLanguage = "de";
let initialTiefe = "an";

try {
  initialTheme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
  initialLanguage = localStorage.getItem("language") === "en" ? "en" : "de";
  initialTiefe = localStorage.getItem("tiefe") === "aus" ? "aus" : "an";
} catch {
  // German and the light theme remain the defaults.
}

applyTheme(initialTheme);
applyTiefe(initialTiefe);
applyLanguage(initialLanguage);

window.alcofasiaUi = {
  countryLabel,
  getLanguage: () => language
};
