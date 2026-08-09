const app = document.querySelector("[data-admin-app]");
const navigation = document.querySelector("[data-country-navigation]");
const search = document.querySelector("[data-country-search]");
const count = document.querySelector("[data-country-count]");
const loading = document.querySelector("[data-loading-state]");
const form = document.querySelector("[data-country-form]");
const saveBar = document.querySelector("[data-save-bar]");
const saveButton = document.querySelector("[data-save-country]");
const resetButton = document.querySelector("[data-reset-country]");
const status = document.querySelector("[data-save-status]");
const ui = window.alcofasiaUi;

const translations = {
  de: {
    eyebrow: "Inhaltsverwaltung", openPage: "Öffentliche Seite öffnen ↗", search: "Land suchen",
    discard: "Änderungen verwerfen", save: "Land speichern", countries: "Länder", withContent: "mit Inhalt",
    noContent: "Noch ohne Inhalt", content: "Inhalt hinterlegt", basics: "Grundangaben", basicsCopy: "Titel und Untertitel der Länderseite.",
    texts: "Beschreibung", textsCopy: "Die erklärenden Absätze auf der öffentlichen Seite.", addParagraph: "+ Absatz",
    facts: "Kurzinfos", factsCopy: "Die kompakte Übersicht unter dem Einführungstext.", addFact: "+ Kurzinfo",
    manufacturers: "Hersteller & Produkte", manufacturersCopy: "Hersteller sowie Low-, Standard- und Premium-Auswahl.", addManufacturer: "+ Hersteller",
    products: "Produkte", addProduct: "+ Produkt", listData: "Listendaten", sources: "Quellen", addSource: "+ Quelle",
    name: "Name", title: "Titel", subtitle: "Untertitel", paragraph: "Absatz", label: "Bezeichnung", value: "Wert",
    manufacturer: "Hersteller", manufacturerLabel: "Reihenfolge", tier: "Kategorie", productName: "Produktname", meta: "Produktzeile",
    description: "Beschreibung", availability: "Verfügbarkeit", origin: "Herkunft", style: "Stil", ingredients: "Zutaten",
    alcohol: "Alkoholgehalt", classification: "Einordnung", sourceLabel: "Quellenname", url: "Internetadresse", note: "Hinweis",
    remove: "Entfernen", changed: "Nicht gespeicherte Änderungen", saving: "Wird gespeichert …", saved: "Gespeichert.",
    saveFailed: "Speichern fehlgeschlagen.", loadFailed: "Die Inhalte konnten nicht geladen werden.", empty: "Keine Länder gefunden.",
    confirmLeave: "Nicht gespeicherte Änderungen verwerfen?", languageDe: "Deutsch", languageEn: "Englisch"
  },
  en: {
    eyebrow: "Content management", openPage: "Open public page ↗", search: "Search country",
    discard: "Discard changes", save: "Save country", countries: "countries", withContent: "with content",
    noContent: "No content yet", content: "Content available", basics: "Basics", basicsCopy: "Title and subtitle of the country page.",
    texts: "Description", textsCopy: "The explanatory paragraphs on the public page.", addParagraph: "+ Paragraph",
    facts: "Key facts", factsCopy: "The compact overview below the introduction.", addFact: "+ Key fact",
    manufacturers: "Producers & products", manufacturersCopy: "Producers and the low, standard and premium selection.", addManufacturer: "+ Producer",
    products: "Products", addProduct: "+ Product", listData: "List data", sources: "Sources", addSource: "+ Source",
    name: "Name", title: "Title", subtitle: "Subtitle", paragraph: "Paragraph", label: "Label", value: "Value",
    manufacturer: "Producer", manufacturerLabel: "Order", tier: "Tier", productName: "Product name", meta: "Product line",
    description: "Description", availability: "Availability", origin: "Origin", style: "Style", ingredients: "Ingredients",
    alcohol: "Alcohol content", classification: "Positioning", sourceLabel: "Source name", url: "Web address", note: "Note",
    remove: "Remove", changed: "Unsaved changes", saving: "Saving …", saved: "Saved.",
    saveFailed: "Save failed.", loadFailed: "The content could not be loaded.", empty: "No countries found.",
    confirmLeave: "Discard unsaved changes?", languageDe: "German", languageEn: "English"
  }
};

let content = new Map();
let countryKeys = [];
let selectedKey;
let draft;
let cleanDraft = "";
let dirty = false;

const t = (key) => translations[ui.getLanguage()]?.[key] ?? key;
const clone = (value) => JSON.parse(JSON.stringify(value));
const localized = (de = "", en = de) => ({ de, en });
const escapeSelector = (value) => CSS.escape(value);

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const markDirty = () => {
  dirty = JSON.stringify(draft) !== cleanDraft;
  status.textContent = dirty ? t("changed") : "";
  saveButton.disabled = !dirty;
};

const field = ({ label, target, key, multiline = false, type = "text" }) => {
  const wrap = element("label", "field");
  const caption = element("span", "field-label", label);
  const control = element(multiline ? "textarea" : "input", multiline ? "field-textarea" : "field-input");
  if (!multiline) control.type = type;
  control.value = target[key] ?? "";
  control.addEventListener("input", () => {
    target[key] = control.value;
    markDirty();
  });
  wrap.append(caption, control);
  return wrap;
};

const localizedFields = (label, target, { multiline = false } = {}) => {
  target.de ??= "";
  target.en ??= "";
  const grid = element("div", "field-grid");
  for (const language of ["de", "en"]) {
    const languageName = language === "de" ? t("languageDe") : t("languageEn");
    const wrap = field({ label: `${label} · ${languageName}`, target, key: language, multiline });
    wrap.querySelector(".field-label").append(element("span", "language-tag", language.toUpperCase()));
    grid.append(wrap);
  }
  return grid;
};

const actionButton = (text, action, className = "button button-small") => {
  const button = element("button", className, text);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
};

const sectionHeader = (title, copy, action) => {
  const header = element("div", "section-header");
  const words = element("div");
  words.append(element("h3", "section-title", title));
  if (copy) words.append(element("p", "section-copy", copy));
  header.append(words);
  if (action) header.append(action);
  return header;
};

const defaultProduct = () => ({
  tier: localized("Low", "Low"), name: "", meta: localized(), description: localized(), availability: localized("Demnächst erhältlich", "Coming soon"),
  list: { origin: localized(), style: localized(), ingredients: localized(), alcohol: localized(), classification: localized() }
});

const defaultCountry = (key) => ({
  key,
  name: localized(key, ui.countryLabel(key)),
  title: localized(),
  subtitle: localized(),
  paragraphs: [],
  facts: [],
  manufacturers: [],
  note: localized(),
  sources: []
});

const renderRepeater = ({ items, label, renderItem, addLabel, createItem }) => {
  const list = element("div", "repeater");
  items.forEach((item, index) => {
    const card = element("div", "repeater-item");
    const header = element("div", "item-header");
    header.append(
      element("p", "item-title", `${label} ${index + 1}`),
      actionButton(t("remove"), () => {
        items.splice(index, 1);
        renderForm();
        markDirty();
      }, "button button-small button-danger")
    );
    card.append(header, renderItem(item, index));
    list.append(card);
  });
  list.append(actionButton(addLabel, () => {
    items.push(createItem());
    renderForm();
    markDirty();
  }));
  return list;
};

const renderProduct = (product, products, productIndex) => {
  const card = element("div", "product-card-admin");
  const header = element("div", "item-header");
  header.append(
    element("p", "item-title", product.name || `${t("products")} ${productIndex + 1}`),
    actionButton(t("remove"), () => {
      products.splice(productIndex, 1);
      renderForm();
      markDirty();
    }, "button button-small button-danger")
  );
  card.append(header);
  card.append(localizedFields(t("tier"), product.tier));
  card.append(field({ label: t("productName"), target: product, key: "name" }));
  card.append(localizedFields(t("meta"), product.meta));
  card.append(localizedFields(t("description"), product.description, { multiline: true }));
  card.append(localizedFields(t("availability"), product.availability));
  const listFields = element("div", "list-fields");
  listFields.append(element("p", "item-title", t("listData")));
  for (const key of ["origin", "style", "ingredients", "alcohol", "classification"]) {
    listFields.append(localizedFields(t(key), product.list[key]));
  }
  card.append(listFields);
  return card;
};

const renderManufacturer = (manufacturer, manufacturerIndex) => {
  const card = element("div", "manufacturer-card");
  const header = element("div", "item-header");
  header.append(
    element("p", "item-title", `${t("manufacturer")} ${manufacturerIndex + 1}`),
    actionButton(t("remove"), () => {
      draft.manufacturers.splice(manufacturerIndex, 1);
      renderForm();
      markDirty();
    }, "button button-small button-danger")
  );
  card.append(header);
  card.append(localizedFields(t("manufacturerLabel"), manufacturer.label));
  card.append(field({ label: t("manufacturer"), target: manufacturer, key: "name" }));
  const productHeader = sectionHeader(t("products"), "", actionButton(t("addProduct"), () => {
    manufacturer.products.push(defaultProduct());
    renderForm();
    markDirty();
  }));
  card.append(productHeader);
  const list = element("div", "product-list-admin");
  manufacturer.products.forEach((product, index) => list.append(renderProduct(product, manufacturer.products, index)));
  card.append(list);
  return card;
};

const renderForm = () => {
  if (!draft) return;
  form.replaceChildren();
  const heading = element("div", "form-heading");
  const headingWords = element("div");
  headingWords.append(element("h2", "", draft.name.de || draft.key));
  headingWords.append(element("span", "content-state", content.has(draft.key) ? t("content") : t("noContent")));
  heading.append(headingWords);
  form.append(heading);

  const basics = element("section", "section");
  basics.append(sectionHeader(t("basics"), t("basicsCopy")));
  basics.append(localizedFields(t("name"), draft.name));
  basics.append(localizedFields(t("title"), draft.title));
  basics.append(localizedFields(t("subtitle"), draft.subtitle));
  form.append(basics);

  const paragraphs = element("section", "section");
  paragraphs.append(sectionHeader(t("texts"), t("textsCopy")));
  paragraphs.append(renderRepeater({
    items: draft.paragraphs, label: t("paragraph"), addLabel: t("addParagraph"), createItem: () => localized(),
    renderItem: (item) => localizedFields(t("paragraph"), item, { multiline: true })
  }));
  form.append(paragraphs);

  const facts = element("section", "section");
  facts.append(sectionHeader(t("facts"), t("factsCopy")));
  facts.append(renderRepeater({
    items: draft.facts, label: t("facts"), addLabel: t("addFact"), createItem: () => ({ label: localized(), value: localized() }),
    renderItem: (item) => {
      const wrap = element("div");
      wrap.append(localizedFields(t("label"), item.label), localizedFields(t("value"), item.value));
      return wrap;
    }
  }));
  form.append(facts);

  const manufacturers = element("section", "section");
  manufacturers.append(sectionHeader(t("manufacturers"), t("manufacturersCopy"), actionButton(t("addManufacturer"), () => {
    draft.manufacturers.push({ label: localized(`${draft.manufacturers.length + 1}. Hersteller`, `${draft.manufacturers.length + 1}. Producer`), name: "", products: [] });
    renderForm();
    markDirty();
  })));
  draft.manufacturers.forEach((manufacturer, index) => manufacturers.append(renderManufacturer(manufacturer, index)));
  form.append(manufacturers);

  const note = element("section", "section");
  note.append(sectionHeader(t("note"), ""), localizedFields(t("note"), draft.note, { multiline: true }));
  form.append(note);

  const sources = element("section", "section");
  sources.append(sectionHeader(t("sources"), ""));
  sources.append(renderRepeater({
    items: draft.sources, label: t("sources"), addLabel: t("addSource"), createItem: () => ({ label: localized(), url: "" }),
    renderItem: (item) => {
      const wrap = element("div");
      wrap.append(localizedFields(t("sourceLabel"), item.label), field({ label: t("url"), target: item, key: "url", type: "url" }));
      return wrap;
    }
  }));
  form.append(sources);
};

const renderNavigation = () => {
  const query = search.value.trim().toLocaleLowerCase(ui.getLanguage());
  const visible = countryKeys.filter((key) => ui.countryLabel(key).toLocaleLowerCase(ui.getLanguage()).includes(query));
  const completed = countryKeys.filter((key) => content.has(key)).length;
  count.textContent = `${countryKeys.length} ${t("countries")} · ${completed} ${t("withContent")}`;
  navigation.replaceChildren();
  if (!visible.length) navigation.append(element("p", "section-copy", t("empty")));
  for (const key of visible) {
    const button = element("button", "country-button");
    button.type = "button";
    button.dataset.hasContent = String(content.has(key));
    button.setAttribute("aria-current", String(key === selectedKey));
    button.append(element("span", "", ui.countryLabel(key)), element("span", "content-dot"));
    button.addEventListener("click", () => selectCountry(key));
    navigation.append(button);
  }
};

const selectCountry = (key, force = false) => {
  if (!force && dirty && !window.confirm(t("confirmLeave"))) return;
  selectedKey = key;
  draft = clone(content.get(key) ?? defaultCountry(key));
  cleanDraft = JSON.stringify(draft);
  dirty = false;
  status.textContent = "";
  saveButton.disabled = true;
  loading.hidden = true;
  form.hidden = false;
  saveBar.hidden = false;
  renderNavigation();
  renderForm();
  document.querySelector(`.country-button[aria-current="true"]`)?.scrollIntoView({ block: "nearest" });
};

const updateInterfaceLanguage = () => {
  document.querySelectorAll("[data-admin-text]").forEach((node) => { node.textContent = t(node.dataset.adminText); });
  renderNavigation();
  renderForm();
  markDirty();
};

const load = async () => {
  try {
    const [contentResponse, mapResponse] = await Promise.all([fetch("/api/countries"), fetch("/asia.svg")]);
    if (!contentResponse.ok || !mapResponse.ok) throw new Error("Content request failed");
    const document = await contentResponse.json();
    const svgText = await mapResponse.text();
    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml");
    content = new Map(document.countries.map((country) => [country.key, country]));
    countryKeys = [...new Set([
      ...[...svg.querySelectorAll("path[data-country]")].map((path) => path.getAttribute("data-country")),
      ...content.keys()
    ])].filter(Boolean).sort((a, b) => ui.countryLabel(a).localeCompare(ui.countryLabel(b), ui.getLanguage()));
    app.setAttribute("aria-busy", "false");
    renderNavigation();
    selectCountry(content.keys().next().value ?? countryKeys[0], true);
  } catch (error) {
    console.error(error);
    loading.textContent = t("loadFailed");
    app.setAttribute("aria-busy", "false");
  }
};

saveButton.addEventListener("click", async () => {
  if (!draft || !dirty) return;
  saveButton.disabled = true;
  resetButton.disabled = true;
  status.textContent = t("saving");
  try {
    const response = await fetch(`/api/admin/countries/${encodeURIComponent(draft.key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    if (!response.ok) throw new Error((await response.json()).error ?? `HTTP ${response.status}`);
    const result = await response.json();
    content.set(draft.key, clone(result.country));
    draft = clone(result.country);
    cleanDraft = JSON.stringify(draft);
    dirty = false;
    status.textContent = t("saved");
    renderNavigation();
    renderForm();
  } catch (error) {
    console.error(error);
    status.textContent = t("saveFailed");
    saveButton.disabled = false;
  } finally {
    resetButton.disabled = false;
  }
});

resetButton.addEventListener("click", () => selectCountry(selectedKey, true));
search.addEventListener("input", renderNavigation);
window.addEventListener("alcofasia:languagechange", updateInterfaceLanguage);
window.addEventListener("beforeunload", (event) => {
  if (dirty) event.preventDefault();
});

updateInterfaceLanguage();
await load();
