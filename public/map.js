const map = document.querySelector("[data-map]");
const tooltip = document.querySelector("[data-country-tooltip]");
const countryList = document.querySelector("[data-country-list]");
const viewToggle = document.querySelector("[data-view-toggle]");
const ui = window.alcofasiaUi;
let countryDetails = new Map();
let contentCountries;
let returnToList = false;
let activeDetail;

const languageValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[ui.getLanguage()] ?? value.de ?? value.en ?? "";
};

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const hideCountryDetail = () => {
  if (!activeDetail) return;
  activeDetail.hidden = true;
  map.hidden = returnToList;
  countryList.hidden = !returnToList;
  viewToggle.hidden = false;
  activeDetail = undefined;
};

const showCountryDetail = (countryName) => {
  activeDetail = countryDetails.get(countryName);
  if (!activeDetail) return;
  returnToList = !countryList.hidden;
  map.hidden = true;
  countryList.hidden = true;
  activeDetail.hidden = false;
  viewToggle.hidden = true;
  tooltip.dataset.visible = "false";
  activeDetail.focus();
};

const backButton = (bottom = false) => {
  const button = node("button", `detail-back${bottom ? " detail-back-bottom" : ""}`, ui.getLanguage() === "en" ? "← Back" : "← Zurück");
  button.type = "button";
  button.dataset.detailBack = "";
  button.addEventListener("click", hideCountryDetail);
  return button;
};

const renderProduct = (product) => {
  const card = node("div", "product-card");
  card.append(
    node("p", "product-label", languageValue(product.tier)),
    node("h3", "product-name", product.name),
    node("p", "product-meta", languageValue(product.meta)),
    node("p", "product-description", languageValue(product.description)),
    node("span", "availability", languageValue(product.availability))
  );
  return card;
};

const renderCountry = (country) => {
  const article = node("article", "country-detail");
  article.dataset.countryDetail = country.key;
  article.hidden = true;
  article.tabIndex = -1;
  article.append(
    backButton(),
    node("p", "country-kicker", languageValue(country.name)),
    node("h2", "", languageValue(country.title)),
    node("p", "country-subtitle", languageValue(country.subtitle))
  );

  const copy = node("div", "country-copy");
  for (const paragraph of country.paragraphs ?? []) copy.append(node("p", "", languageValue(paragraph)));
  article.append(copy);

  if (country.facts?.length) {
    const facts = node("dl", "spirit-facts");
    for (const fact of country.facts) {
      const item = node("div");
      item.append(node("dt", "", languageValue(fact.label)), node("dd", "", languageValue(fact.value)));
      facts.append(item);
    }
    article.append(facts);
  }

  for (const manufacturer of country.manufacturers ?? []) {
    const block = node("div", "manufacturer-block");
    if (languageValue(manufacturer.label)) block.append(node("p", "product-label", languageValue(manufacturer.label)));
    if (manufacturer.name) block.append(node("h3", "manufacturer-title", manufacturer.name));
    const products = node("div", "product-grid");
    for (const product of manufacturer.products ?? []) products.append(renderProduct(product));
    block.append(products);
    article.append(block);
  }

  if (languageValue(country.note)) article.append(node("p", "country-note product-description", languageValue(country.note)));

  if (country.sources?.length) {
    const sources = node("p", "sources", ui.getLanguage() === "en" ? "Sources: " : "Quellen: ");
    country.sources.forEach((source, index) => {
      if (index) sources.append(document.createTextNode(" · "));
      const link = node("a", "", languageValue(source.label));
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      sources.append(link);
    });
    article.append(sources);
  }

  article.append(backButton(true));
  return article;
};

const renderCountryDetails = () => {
  const activeKey = activeDetail?.dataset.countryDetail;
  for (const detail of document.querySelectorAll("[data-country-detail]")) detail.remove();
  const articles = (contentCountries ?? []).map(renderCountry);
  viewToggle.before(...articles);
  countryDetails = new Map(articles.map((article) => [article.dataset.countryDetail, article]));
  activeDetail = activeKey ? countryDetails.get(activeKey) : undefined;
  if (activeDetail) activeDetail.hidden = false;
};

const loadContent = async () => {
  for (const url of ["/api/countries", "/content.json"]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const document = await response.json();
      if (Array.isArray(document.countries)) {
        contentCountries = document.countries;
        renderCountryDetails();
        return;
      }
    } catch (error) {
      console.warn(`Could not load ${url}`, error);
    }
  }

  countryDetails = new Map(
    [...document.querySelectorAll("[data-country-detail]")].map((detail) => [detail.dataset.countryDetail, detail])
  );
  for (const button of document.querySelectorAll("[data-detail-back]")) button.addEventListener("click", hideCountryDetail);
};

const moveTooltip = (event) => {
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
};

const showCountry = (event) => {
  tooltip.textContent = ui.countryLabel(event.currentTarget.dataset.country);
  moveTooltip(event);
  tooltip.dataset.visible = "true";
};

const hideCountry = () => { tooltip.dataset.visible = "false"; };

try {
  const [mapResponse] = await Promise.all([fetch("/asia.svg"), loadContent()]);
  if (!mapResponse.ok) throw new Error(`Map could not be loaded: ${mapResponse.status}`);
  map.innerHTML = await mapResponse.text();
  const countries = [...map.querySelectorAll("path[data-country]")];

  const updateViewToggle = () => {
    const showMapLabel = ui.getLanguage() === "en" ? "Show map" : "Karte anzeigen";
    const showCountriesLabel = ui.getLanguage() === "en" ? "Show countries" : "Länder anzeigen";
    viewToggle.textContent = countryList.hidden ? showCountriesLabel : showMapLabel;
  };

  const renderCountryList = () => {
    const names = countries.map((country) => country.dataset.country)
      .sort((a, b) => ui.countryLabel(a).localeCompare(ui.countryLabel(b), ui.getLanguage()));
    countryList.replaceChildren(...names.map((name) => {
      const hasDetails = countryDetails.has(name);
      const word = node(hasDetails ? "button" : "span", hasDetails ? "country-word" : "", ui.countryLabel(name));
      if (hasDetails) {
        word.type = "button";
        word.addEventListener("click", () => showCountryDetail(name));
      }
      return word;
    }));
  };

  const updateMapLanguage = () => {
    if (contentCountries) renderCountryDetails();
    const isEnglish = ui.getLanguage() === "en";
    for (const country of countries) {
      const countryName = country.dataset.country;
      const label = ui.countryLabel(countryName);
      const hasDetails = countryDetails.has(countryName);
      country.classList.toggle("has-content", hasDetails);
      country.setAttribute("aria-label", hasDetails ? `${label} – ${isEnglish ? "content available" : "Inhalt verfügbar"}` : label);
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
