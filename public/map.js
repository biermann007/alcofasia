const map = document.querySelector("[data-map]");
const tooltip = document.querySelector("[data-country-tooltip]");
const countryList = document.querySelector("[data-country-list]");
const viewToggle = document.querySelector("[data-view-toggle]");

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
  }

  const names = countries
    .map((country) => country.dataset.country)
    .sort((a, b) => a.localeCompare(b, "de"));

  countryList.replaceChildren(
    ...names.map((name) => {
      const word = document.createElement("span");
      word.textContent = name;
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
