// Sprache und Hell-Dunkel-Umschaltung. Die Tiefen-Optik ist immer an
// (data-tiefe="an" steht fest am <html>-Element der Startseite).
//
// Die englischen Fassungen stehen nicht mehr in einem Wörterbuch, sondern als
// data-en-Attribut direkt am jeweiligen Element. Der Worker setzt sie beim
// Ausliefern aus der Datenbank ein. Fehlt das Attribut, ist der Text in beiden
// Sprachen gleich.

const root = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeControl = document.querySelector("[data-theme-control]");
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

let initialTheme = "light";
let initialLanguage = "de";

try {
  initialTheme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
  initialLanguage = localStorage.getItem("language") === "en" ? "en" : "de";
} catch {
  // German and the light theme remain the defaults.
}

applyTheme(initialTheme);
applyLanguage(initialLanguage);

window.alcofasiaUi = {
  countryLabel,
  getLanguage: () => language
};
