const map = document.querySelector("[data-map]");
const tooltip = document.querySelector("[data-country-tooltip]");
const countryList = document.querySelector("[data-country-list]");
const countryDetails = new Map(
  [...document.querySelectorAll("[data-country-detail]")].map((detail) => [
    detail.dataset.countryDetail,
    detail
  ])
);
const detailBackButtons = document.querySelectorAll("[data-detail-back]");
const viewToggle = document.querySelector("[data-view-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const root = document.documentElement;
let returnToList = false;
let activeDetail;

const showCountryDetail = (countryName) => {
  activeDetail = countryDetails.get(countryName);

  if (!activeDetail) {
    return;
  }

  returnToList = !countryList.hidden;
  map.hidden = true;
  countryList.hidden = true;
  activeDetail.hidden = false;
  viewToggle.hidden = true;
  tooltip.dataset.visible = "false";
  activeDetail.focus();
};

const hideCountryDetail = () => {
  activeDetail.hidden = true;
  map.hidden = returnToList;
  countryList.hidden = !returnToList;
  viewToggle.hidden = false;
  activeDetail = undefined;
};

for (const button of detailBackButtons) {
  button.addEventListener("click", hideCountryDetail);
}

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

    const countryName = country.dataset.country;

    if (countryDetails.has(countryName)) {
      country.classList.add("has-content");
      country.setAttribute("role", "button");
      country.setAttribute("tabindex", "0");
      country.setAttribute("aria-label", `${countryName} – Inhalt verfügbar`);
      country.addEventListener("click", () => showCountryDetail(countryName));
      country.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showCountryDetail(countryName);
        }
      });
    }
  }

  const names = countries
    .map((country) => country.dataset.country)
    .sort((a, b) => a.localeCompare(b, "de"));

  countryList.replaceChildren(
    ...names.map((name) => {
      const hasDetails = countryDetails.has(name);
      const word = document.createElement(hasDetails ? "button" : "span");
      word.textContent = name;

      if (hasDetails) {
        word.type = "button";
        word.className = "country-word";
        word.addEventListener("click", () => showCountryDetail(name));
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
