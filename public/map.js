const map = document.querySelector("[data-map]");
const tooltip = document.querySelector("[data-country-tooltip]");
const countryList = document.querySelector("[data-country-list]");
const countryDetail = document.querySelector("[data-country-detail]");
const detailBack = document.querySelector("[data-detail-back]");
const viewToggle = document.querySelector("[data-view-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const root = document.documentElement;
let returnToList = false;

const showChinaDetail = () => {
  returnToList = !countryList.hidden;
  map.hidden = true;
  countryList.hidden = true;
  countryDetail.hidden = false;
  viewToggle.hidden = true;
  tooltip.dataset.visible = "false";
  countryDetail.focus();
};

const hideCountryDetail = () => {
  countryDetail.hidden = true;
  map.hidden = returnToList;
  countryList.hidden = !returnToList;
  viewToggle.hidden = false;
};

detailBack.addEventListener("click", hideCountryDetail);

const applyTheme = (theme) => {
  const isDark = theme === "dark";

  root.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeColor.content = isDark ? "#000000" : "#ffffff";
};

try {
  applyTheme(localStorage.getItem("theme") === "dark" ? "dark" : "light");
} catch {
  applyTheme("light");
}

themeToggle.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(theme);

  try {
    localStorage.setItem("theme", theme);
  } catch {
    // The mode still works when browser storage is unavailable.
  }
});

const moveTooltip = (event) => {
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
};

const showCountry = (event) => {
  tooltip.textContent = event.currentTarget.dataset.country;
  moveTooltip(event);
  tooltip.dataset.visible = "true";
};

const hideCountry = () => {
  tooltip.dataset.visible = "false";
};

try {
  const response = await fetch("/asia.svg");

  if (!response.ok) {
    throw new Error(`Map could not be loaded: ${response.status}`);
  }

  map.innerHTML = await response.text();

  const countries = [...map.querySelectorAll("path[data-country]")];

  for (const country of countries) {
    country.addEventListener("pointerenter", showCountry);
    country.addEventListener("pointermove", moveTooltip);
    country.addEventListener("pointerleave", hideCountry);

    if (country.dataset.country === "China") {
      country.setAttribute("role", "button");
      country.setAttribute("tabindex", "0");
      country.addEventListener("click", showChinaDetail);
      country.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showChinaDetail();
        }
      });
    }
  }

  const names = countries
    .map((country) => country.dataset.country)
    .sort((a, b) => a.localeCompare(b, "de"));

  countryList.replaceChildren(
    ...names.map((name) => {
      const word = document.createElement(name === "China" ? "button" : "span");
      word.textContent = name;

      if (name === "China") {
        word.type = "button";
        word.className = "country-word";
        word.addEventListener("click", showChinaDetail);
      }

      return word;
    })
  );

  viewToggle.disabled = false;
  viewToggle.addEventListener("click", () => {
    const showCountries = countryList.hidden;

    map.hidden = showCountries;
    countryList.hidden = !showCountries;
    tooltip.dataset.visible = "false";
    viewToggle.textContent = showCountries ? "Karte anzeigen" : "Länder anzeigen";
    viewToggle.setAttribute("aria-expanded", String(showCountries));
  });
} catch (error) {
  console.warn(error);
}
