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
const ui = window.alcofasiaUi;
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

const moveTooltip = (event) => {
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
};

const showCountry = (event) => {
  tooltip.textContent = ui.countryLabel(event.currentTarget.dataset.country);
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

  const updateViewToggle = () => {
    const showMapLabel = ui.getLanguage() === "en" ? "Show map" : "Karte anzeigen";
    const showCountriesLabel = ui.getLanguage() === "en" ? "Show countries" : "Länder anzeigen";
    viewToggle.textContent = countryList.hidden ? showCountriesLabel : showMapLabel;
  };

  const renderCountryList = () => {
    const names = countries
      .map((country) => country.dataset.country)
      .sort((a, b) => ui.countryLabel(a).localeCompare(ui.countryLabel(b), ui.getLanguage()));

    countryList.replaceChildren(
      ...names.map((name) => {
        const hasDetails = countryDetails.has(name);
        const word = document.createElement(hasDetails ? "button" : "span");
        word.textContent = ui.countryLabel(name);

        if (hasDetails) {
          word.type = "button";
          word.className = "country-word";
          word.addEventListener("click", () => showCountryDetail(name));
        }

        return word;
      })
    );
  };

  const updateMapLanguage = () => {
    const isEnglish = ui.getLanguage() === "en";

    for (const country of countries) {
      const countryName = country.dataset.country;
      const label = ui.countryLabel(countryName);
      const hasDetails = countryDetails.has(countryName);
      country.setAttribute("aria-label", hasDetails
        ? `${label} – ${isEnglish ? "content available" : "Inhalt verfügbar"}`
        : label);
    }

    map.querySelector("svg")?.setAttribute("aria-label", isEnglish ? "Interactive map of Asia" : "Interaktive Länderkarte");
    renderCountryList();
    updateViewToggle();
  };

  for (const country of countries) {
    country.addEventListener("pointerenter", showCountry);
    country.addEventListener("pointermove", moveTooltip);
    country.addEventListener("pointerleave", hideCountry);

    const countryName = country.dataset.country;

    if (countryDetails.has(countryName)) {
      country.classList.add("has-content");
      country.setAttribute("role", "button");
      country.setAttribute("tabindex", "0");
      country.addEventListener("click", () => showCountryDetail(countryName));
      country.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showCountryDetail(countryName);
        }
      });
    }
  }

  updateMapLanguage();
  window.addEventListener("alcofasia:languagechange", updateMapLanguage);
  viewToggle.disabled = false;
  viewToggle.addEventListener("click", () => {
    const showCountries = countryList.hidden;

    map.hidden = showCountries;
    countryList.hidden = !showCountries;
    tooltip.dataset.visible = "false";
    viewToggle.setAttribute("aria-expanded", String(showCountries));
    updateViewToggle();
  });
} catch (error) {
  console.warn(error);
}
