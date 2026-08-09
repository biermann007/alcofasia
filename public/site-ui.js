const root = document.documentElement;
const themeColor = document.querySelector('meta[name="theme-color"]');
const themeControl = document.querySelector("[data-theme-control]");
const languageControls = document.querySelectorAll("[data-language]");
const controlsLabel = document.querySelector(".site-controls");

const countryNames = {
  Afghanistan: "Afghanistan",
  Armenien: "Armenia",
  Aserbaidschan: "Azerbaijan",
  Bangladesch: "Bangladesh",
  Bhutan: "Bhutan",
  Brunei: "Brunei",
  China: "China",
  Georgien: "Georgia",
  Indien: "India",
  Indonesien: "Indonesia",
  Irak: "Iraq",
  Iran: "Iran",
  Israel: "Israel",
  Japan: "Japan",
  Jemen: "Yemen",
  Jordanien: "Jordan",
  Kambodscha: "Cambodia",
  Kasachstan: "Kazakhstan",
  Katar: "Qatar",
  Kirgisistan: "Kyrgyzstan",
  Kuwait: "Kuwait",
  Laos: "Laos",
  Libanon: "Lebanon",
  Malaysia: "Malaysia",
  Mongolei: "Mongolia",
  Myanmar: "Myanmar",
  Nepal: "Nepal",
  Nordkorea: "North Korea",
  Oman: "Oman",
  Osttimor: "Timor-Leste",
  Pakistan: "Pakistan",
  Palästina: "Palestine",
  Philippinen: "Philippines",
  Russland: "Russia",
  "Saudi-Arabien": "Saudi Arabia",
  "Sri Lanka": "Sri Lanka",
  Südkorea: "South Korea",
  Syrien: "Syria",
  Tadschikistan: "Tajikistan",
  Taiwan: "Taiwan",
  Thailand: "Thailand",
  Türkei: "Türkiye",
  Turkmenistan: "Turkmenistan",
  Usbekistan: "Uzbekistan",
  "Vereinigte Arabische Emirate": "United Arab Emirates",
  Vietnam: "Vietnam",
  Zypern: "Cyprus"
};

const english = {
  "← Zurück": "← Back",
  "Keine legale Spirituose": "No legal spirit",
  "Keine nationale Produktauswahl": "No national product selection",
  "Afghanistan hat derzeit keine legal vermarktete nationale Spirituosenmarke. Die Weltgesundheitsorganisation führt das Land mit einem vollständigen Verbot für alkoholische Getränke.": "Afghanistan currently has no legally marketed national spirits brand. The World Health Organization lists the country as having a total ban on alcoholic beverages.",
  "Auch der Verkauf und Transport von Alkohol werden aktuell verfolgt: Das afghanische Innenministerium berichtete 2025 über Festnahmen und beschlagnahmte alkoholische Getränke in Kabul.": "The sale and transport of alcohol are also currently prosecuted: in 2025, the Afghan Ministry of Interior reported arrests and the seizure of alcoholic beverages in Kabul.",
  "Deshalb weisen wir Afghanistan transparent aus, bieten aber weder Low-, Standard- noch Premiumprodukte an. Nicht registrierte oder privat gebrannte Erzeugnisse kommen wegen Rechtslage, Herkunft und Produktsicherheit nicht für den Verkauf infrage.": "We therefore list Afghanistan transparently but offer no Low, Standard or Premium products. Unregistered or privately distilled products are not considered for sale because of the legal situation, provenance and product safety.",
  "Spirituose": "Spirit",
  "Keine legale nationale Auswahl": "No legal national selection",
  "Status": "Status",
  "Vollständiges Alkoholverbot": "Total alcohol ban",
  "Herkunft": "Origin",
  "Zutaten": "Ingredients",
  "Hersteller": "Producer",
  "Kein legaler Hersteller nachweisbar": "No legal producer identified",
  "Sortiment": "Range",
  "Nicht verfügbar": "Not available",
  "Keine Kategorie": "No category",
  "Keine legale Produktauswahl": "No legal product selection",
  "Low · Standard · Premium entfallen": "Low · Standard · Premium not applicable",
  "Wir nehmen für Afghanistan keine alkoholischen Produkte in das Sortiment auf.": "We do not add alcoholic products from Afghanistan to the range.",
  "Nicht bestellbar": "Not available to order",
  "Chinas bekannteste Spirituose": "China’s best-known spirit",
  "Baijiu ist eine traditionelle chinesische Getreidespirituose. Sie wird unter anderem aus Sorghum, Weizen oder Reis hergestellt und nicht nach dem Ausgangsgetreide, sondern nach ihrem Aroma eingeteilt.": "Baijiu is a traditional Chinese grain spirit. It is made from ingredients including sorghum, wheat or rice and is classified by aroma rather than by its base grain.",
  "In China wird Baijiu meist pur aus kleinen Gläsern zu gemeinsamen Mahlzeiten und feierlichen Trinksprüchen serviert. Der berühmteste Vertreter ist Kweichow Moutai aus der Provinz Guizhou.": "In China, baijiu is usually served neat in small glasses with shared meals and ceremonial toasts. Its most famous representative is Kweichow Moutai from Guizhou province.",
  "Unsere erste Herstellerwahl ist Kweichow Moutai Co., Ltd. mit Yingbin Purple, Golden Prince und Flying Fairy. Als zweite Herstelleralternative ergänzen wir Wuliangye Yibin Co., Ltd. mit Wuliang Chun Mellow, Wuliang Chun Spring und dem Flaggschiff Wuliangye.": "Our first producer selection is Kweichow Moutai Co., Ltd. with Yingbin Purple, Golden Prince and Flying Fairy. Our second producer alternative is Wuliangye Yibin Co., Ltd. with Wuliang Chun Mellow, Wuliang Chun Spring and the flagship Wuliangye.",
  "Moutai steht für Sauce Aroma auf Basis von rotem Sorghum und Weizen. Wuliangye vertritt den Strong-Aroma-Stil und verbindet fünf Getreidearten: Sorghum, Reis, Klebreis, Weizen und Mais.": "Moutai represents sauce aroma based on red sorghum and wheat. Wuliangye represents the strong-aroma style and combines five grains: sorghum, rice, glutinous rice, wheat and corn.",
  "Aromastil": "Aroma style",
  "Rotes Sorghum, Weizen, Wasser": "Red sorghum, wheat, water",
  "2 Hersteller · je 3 Stufen": "2 producers · 3 tiers each",
  "1. Hersteller": "1st producer",
  "2. Hersteller": "2nd producer",
  "Frisch und mild mit Apfel- und Birnenaromen – der zugängliche Einstieg.": "Fresh and mild with apple and pear aromas — an accessible introduction.",
  "Demnächst erhältlich": "Coming soon",
  "Fruchtig mit Apfel, Pfirsich und gerösteten Mandeln.": "Fruity with apple, peach and toasted almonds.",
  "Das berühmte Flaggschiff: vollmundig, elegant und lang anhaltend.": "The famous flagship: full-bodied, elegant and long-lasting.",
  "Weich und rund – die zugängliche Mid-End-Abfüllung.": "Soft and rounded — the accessible mid-range expression.",
  "Vollmundig und vielschichtig mit sauberem, frischem Finale.": "Full-bodied and layered with a clean, fresh finish.",
  "Das internationale Flaggschiff und der Maßstab für Strong Aroma Baijiu.": "The international flagship and a benchmark for strong-aroma baijiu.",
  "Wodka": "Vodka",
  "Russlands bekannteste Spirituose": "Russia’s best-known spirit",
  "Wodka ist die international bekannteste Spirituose Russlands. Der klare Getreidebrand wird traditionell möglichst rein und neutral hergestellt und meist gut gekühlt, pur und zu Speisen serviert.": "Vodka is Russia’s internationally best-known spirit. The clear grain spirit is traditionally produced to be as pure and neutral as possible and is usually served well chilled, neat and with food.",
  "Unsere erste Herstellerwahl ist Russian Standard Vodka LLC mit Original, Gold und Platinum. Als zweite Herstelleralternative ergänzen wir die LADOGA Group aus Sankt Petersburg mit Czar’s Original, Czar’s Gold und Imperial Collection Golden Snow.": "Our first producer selection is Russian Standard Vodka LLC with Original, Gold and Platinum. Our second producer alternative is the LADOGA Group from Saint Petersburg with Czar’s Original, Czar’s Gold and Imperial Collection Golden Snow.",
  "Russian Standard basiert auf Winterweizen und Wasser aus dem Ladogasee. LADOGA verbindet Getreidealkohol und besonders weiches Wasser; die höheren Stufen nutzen Goldfiltration beziehungsweise echte Goldflocken.": "Russian Standard is based on winter wheat and water from Lake Ladoga. LADOGA combines grain spirit with particularly soft water; the higher tiers use gold filtration or real gold flakes.",
  "Stil": "Style",
  "Sankt Petersburg, Russland": "Saint Petersburg, Russia",
  "Winterweizen, Wasser": "Winter wheat, water",
  "Wodka · 40 % Vol.": "Vodka · 40% ABV",
  "Wodka · 40 % Vol. · 700 ml": "Vodka · 40% ABV · 700 ml",
  "Klar und weich mit dezenter Getreidenote.": "Clean and smooth with a subtle grain note.",
  "Derzeit nicht im Verkauf": "Currently not for sale",
  "Weich und reichhaltig, verfeinert mit sibirischem Ginseng.": "Smooth and rich, refined with Siberian ginseng.",
  "Silberfiltriert, seidig weich und besonders klar.": "Silver-filtered, silky smooth and exceptionally clean.",
  "Vierfach destilliert und in elf Stufen gereinigt.": "Distilled four times and purified in eleven stages.",
  "Zwölfstufig gereinigt und abschließend durch Goldmembranen filtriert.": "Purified in twelve stages and finally filtered through gold membranes.",
  "Sammlerabfüllung mit 23-karätigen Goldflocken.": "Collector’s expression with 23-carat gold flakes.",
  "Die Einfuhr russischer Spirituosen in die Europäische Union ist derzeit untersagt. Das Produkt wird deshalb redaktionell vorgestellt, aber nicht zum Kauf angeboten.": "The import of Russian spirits into the European Union is currently prohibited. These products are therefore presented editorially but are not offered for sale.",
  "Japans traditionelle Spirituose": "Japan’s traditional spirit",
  "Sake ist Japans bekanntestes alkoholisches Getränk, aber keine Spirituose: Er wird gebraut und nicht destilliert. Die traditionelle japanische Spirituose ist Shōchū, ein klarer Brand aus regionalen Zutaten wie Gerste, Süßkartoffeln oder Reis.": "Sake is Japan’s best-known alcoholic drink, but it is not a spirit: it is brewed, not distilled. Japan’s traditional spirit is shochu, a clear distillate made from regional ingredients such as barley, sweet potatoes or rice.",
  "Unsere erste Herstellerwahl ist Sanwa Shurui Co., Ltd. mit der gerstenbasierten iichiko-Familie. Als zweite Herstelleralternative ergänzen wir Kirishima Shuzo Co., Ltd. mit Kuro Kirishima, Aka Kirishima und dem lang gereiften Kuro Kirishima MELT.": "Our first producer selection is Sanwa Shurui Co., Ltd. with the barley-based iichiko family. Our second producer alternative is Kirishima Shuzo Co., Ltd. with Kuro Kirishima, Aka Kirishima and the long-aged Kuro Kirishima MELT.",
  "iichiko basiert auf Gerste und Gersten-Kōji. Kirishima verwendet Süßkartoffeln aus Kyūshū und Reis-Kōji; die Premiumabfüllung MELT wird mehr als 15 Jahre gereift, darunter auch in Eichenfässern.": "iichiko is based on barley and barley koji. Kirishima uses sweet potatoes from Kyushu and rice koji; the premium MELT expression is aged for more than 15 years, including time in oak barrels.",
  "Traditionell wird Shōchū pur, auf Eis, mit kaltem oder heißem Wasser sowie als leichter Highball mit Soda serviert. Durch seinen zurückhaltenden Charakter passt Silhouette zu vielen Speisen.": "Shochu is traditionally served neat, on ice, with cold or hot water, or as a light highball with soda. Silhouette’s restrained character makes it a versatile food companion.",
  "Gerste, Gersten-Kōji, Wasser": "Barley, barley koji, water",
  "Mugi Shōchū · 25 % Vol. · 900 ml": "Barley shochu · 25% ABV · 900 ml",
  "Mugi Shōchū · 25 % Vol. · 720 ml": "Barley shochu · 25% ABV · 720 ml",
  "Mugi Shōchū · 30 % Vol. · 720 ml": "Barley shochu · 30% ABV · 720 ml",
  "Mild, fruchtig und unkompliziert – der Bestseller der Basislinie.": "Mild, fruity and approachable — the bestseller in the core range.",
  "Leicht, weich und vielseitig – Japans Nr. 1 Shōchū-Marke.": "Light, smooth and versatile — Japan’s No. 1 shochu brand.",
  "Lang gereift mit vollerem Aroma und weicher Tiefe.": "Long-aged with a fuller aroma and smooth depth.",
  "Imo Shōchū · 25 % Vol. · 720 ml": "Sweet potato shochu · 25% ABV · 720 ml",
  "Imo Shōchū · 25 % Vol. · 900 ml": "Sweet potato shochu · 25% ABV · 900 ml",
  "Runde Süße und ein klarer, trockener Nachhall.": "Rounded sweetness with a clean, dry finish.",
  "Elegantes, fruchtiges Aroma aus violetten Murasaki-Masari-Süßkartoffeln.": "An elegant, fruity aroma from purple Murasaki Masari sweet potatoes.",
  "Spirituose auf Shōchū-Basis · 30 % Vol. · 720 ml": "Shochu-based spirit · 30% ABV · 720 ml",
  "Über 15 Jahre gereift, mit Eichenholz und feiner Vanillesüße.": "Aged for over 15 years, with oak and delicate vanilla sweetness.",
  "Name": "Country",
  "Herstellerwahl": "Producer selection",
  "Kategorie": "Category",
  "Produkt": "Product",
  "Alkoholgehalt": "Alcohol content",
  "Einordnung": "Positioning",
  "Keine legal vermarktete nationale Spirituose": "No legally marketed national spirit",
  "Vollständiges Alkoholverbot; nicht bestellbar": "Total alcohol ban; not available to order",
  "Sauce Aroma Baijiu": "Sauce-aroma baijiu",
  "53 % Vol.": "53% ABV",
  "Einsteigerfreundlich, frisch und mild": "Entry-friendly, fresh and mild",
  "Fruchtige Mittelstufe": "Fruity middle tier",
  "Bekanntestes Flaggschiff": "Best-known flagship",
  "Yibin, Sichuan, China": "Yibin, Sichuan, China",
  "Sorghum, Reis, Klebreis, Weizen, Mais, Wasser": "Sorghum, rice, glutinous rice, wheat, corn, water",
  "40 % Vol.": "40% ABV",
  "Weiche Mid-End-Abfüllung": "Smooth mid-range expression",
  "52 % Vol.": "52% ABV",
  "Vollmundige obere Mittelstufe": "Full-bodied upper middle tier",
  "Internationales Flaggschiff": "International flagship",
  "Basisprodukt der Premiumreihe": "Core product in the premium range",
  "Premium+ Vodka": "Premium+ vodka",
  "Winterweizen, Wasser, Ginsengextrakt": "Winter wheat, water, ginseng extract",
  "Verfeinerte Mittelstufe": "Refined middle tier",
  "Super-Premium Vodka": "Super-premium vodka",
  "Silberfiltriertes Spitzenprodukt": "Silver-filtered top expression",
  "Getreidealkohol, Wasser, Lindenhonig, Lindenblütenaufguss": "Grain spirit, water, linden honey, linden blossom infusion",
  "Vierfach destilliert, elfstufig gereinigt": "Distilled four times, purified in eleven stages",
  "Getreidealkohol, Wasser": "Grain spirit, water",
  "Zwölfstufig gereinigt, goldfiltriert": "Purified in twelve stages, gold-filtered",
  "Sammler-Vodka": "Collector’s vodka",
  "Getreidealkohol, Wasser, 23-karätige Goldflocken": "Grain spirit, water, 23-carat gold flakes",
  "Premium-Sammlerabfüllung": "Premium collector’s expression",
  "Bestseller der Basislinie": "Bestseller in the core range",
  "Japans Nr. 1 Shōchū-Marke": "Japan’s No. 1 shochu brand",
  "Lang gereifter Honkaku Mugi Shōchū": "Long-aged honkaku barley shochu",
  "25 % Vol.": "25% ABV",
  "30 % Vol.": "30% ABV",
  "Lang gereifte Premiumabfüllung": "Long-aged premium expression",
  "Miyakonojō, Miyazaki, Japan": "Miyakonojo, Miyazaki, Japan",
  "Honkaku Imo Shōchū": "Honkaku sweet potato shochu",
  "Süßkartoffeln, Reis-Kōji, Wasser": "Sweet potatoes, rice koji, water",
  "Flaggschiff mit runder Süße": "Flagship with rounded sweetness",
  "Murasaki-Masari-Süßkartoffeln, Reis-Kōji, Wasser": "Murasaki Masari sweet potatoes, rice koji, water",
  "Elegant und fruchtig": "Elegant and fruity",
  "Fassgereifte Spirituose auf Shōchū-Basis": "Barrel-aged shochu-based spirit",
  "Honkaku Shōchū; Eichenfassreifung": "Honkaku shochu; oak-barrel aging",
  "Über 15 Jahre gereifte Premiumabfüllung": "Premium expression aged for over 15 years",
  "3. Hersteller": "3rd producer",
  "3 Hersteller · je 3 Stufen": "3 producers · 3 tiers each",
  "Unsere erste Herstellerwahl ist Kweichow Moutai Co., Ltd. mit Yingbin Purple, Golden Prince und Flying Fairy. Als zweite Herstelleralternative ergänzen wir Wuliangye Yibin Co., Ltd. mit Wuliang Chun Mellow, Wuliang Chun Spring und dem Flaggschiff Wuliangye. Die dritte etablierte Wahl ist Luzhou Laojiao Co., Ltd. mit Touqu D9, Tequ Laojiu und Guojiao 1573 Classic.": "Our first producer selection is Kweichow Moutai Co., Ltd. with Yingbin Purple, Golden Prince and Flying Fairy. Our second producer alternative is Wuliangye Yibin Co., Ltd. with Wuliang Chun Mellow, Wuliang Chun Spring and the flagship Wuliangye. The third established choice is Luzhou Laojiao Co., Ltd. with Touqu D9, Tequ Laojiu and Guojiao 1573 Classic.",
  "Moutai steht für Sauce Aroma auf Basis von rotem Sorghum und Weizen. Wuliangye vertritt den Strong-Aroma-Stil mit fünf Getreidearten. Luzhou Laojiao gilt als Wegbereiter des Strong-Aroma-Baijiu und führt seine Brenntradition über 700 Jahre zurück.": "Moutai represents sauce aroma based on red sorghum and wheat. Wuliangye represents the strong-aroma style with five grains. Luzhou Laojiao is regarded as a pioneer of strong-aroma baijiu and traces its distilling tradition back more than 700 years.",
  "Süßer und sanfter Strong-Aroma-Baijiu für einen zugänglichen Einstieg.": "A sweeter, gentler strong-aroma baijiu for an accessible introduction.",
  "Ein klassischer, vollmundiger Strong-Aroma-Baijiu mit langem Nachhall.": "A classic, full-bodied strong-aroma baijiu with a long finish.",
  "Das Ultra-High-End-Flaggschiff aus den historischen Brennkammern von 1573.": "The ultra-high-end flagship from the historic cellars dating to 1573.",
  "Unsere erste Herstellerwahl ist Russian Standard Vodka LLC mit Original, Gold und Platinum. Als zweite Herstelleralternative ergänzen wir die LADOGA Group aus Sankt Petersburg mit Czar’s Original, Czar’s Gold und Imperial Collection Golden Snow. Die dritte etablierte Wahl ist Tatspirtprom JSC aus Kasan mit Tundra Authentic, Tundra Frozen Juniper und Tundra Forest Woody Notes.": "Our first producer selection is Russian Standard Vodka LLC with Original, Gold and Platinum. Our second producer alternative is the LADOGA Group from Saint Petersburg with Czar’s Original, Czar’s Gold and Imperial Collection Golden Snow. The third established choice is Tatspirtprom JSC from Kazan with Tundra Authentic, Tundra Frozen Juniper and Tundra Forest Woody Notes.",
  "Russian Standard basiert auf Winterweizen und Wasser aus dem Ladogasee. LADOGA verbindet Getreidealkohol und besonders weiches Wasser. Tundra verwendet Alkohol der Klasse Alpha und entwickelt die höheren Stufen mit Wacholder, Pinienkernen, Kräutern und weiteren Pflanzenessenzen.": "Russian Standard is based on winter wheat and water from Lake Ladoga. LADOGA combines grain spirit with particularly soft water. Tundra uses Alpha-grade spirit and develops its higher tiers with juniper, pine nuts, herbs and other botanical essences.",
  "Sankt Petersburg und Kasan, Russland": "Saint Petersburg and Kazan, Russia",
  "Klarer Alpha-Wodka mit fünffach gefiltertem Wasser.": "Clean Alpha-grade vodka made with five-times filtered water.",
  "Mit Wacholder, Pinienkern und einem feinen Akzent von Zitronenöl.": "With juniper, pine nut and a subtle accent of lemon oil.",
  "Kräuterbetonte Premiumabfüllung mit fünf aromatischen Destillaten.": "A herb-forward premium expression with five aromatic distillates.",
  "Unsere erste Herstellerwahl ist Sanwa Shurui Co., Ltd. mit der gerstenbasierten iichiko-Familie. Als zweite Herstelleralternative ergänzen wir Kirishima Shuzo Co., Ltd. mit Kuro Kirishima, Aka Kirishima und Kuro Kirishima MELT. Die dritte etablierte Wahl ist Takara Shuzo Co., Ltd. mit Takara Shochu Jun, Ikkomon und Ikkomon Long-Term Aged Genshu.": "Our first producer selection is Sanwa Shurui Co., Ltd. with the barley-based iichiko family. Our second producer alternative is Kirishima Shuzo Co., Ltd. with Kuro Kirishima, Aka Kirishima and Kuro Kirishima MELT. The third established choice is Takara Shuzo Co., Ltd. with Takara Shochu Jun, Ikkomon and Ikkomon Long-Term Aged Genshu.",
  "iichiko basiert auf Gerste und Gersten-Kōji. Kirishima verwendet Süßkartoffeln aus Kyūshū und Reis-Kōji. Takara Shuzo braut und destilliert seit 1842; Ikkomon wird vollständig aus Süßkartoffeln einschließlich Süßkartoffel-Kōji hergestellt.": "iichiko is based on barley and barley koji. Kirishima uses sweet potatoes from Kyushu and rice koji. Takara Shuzo has brewed and distilled since 1842; Ikkomon is made entirely from sweet potatoes, including sweet-potato koji.",
  "Kyūshū und Kyōto, Japan": "Kyushu and Kyoto, Japan",
  "Kōrui Shōchū · 25 % Vol. · 720 ml": "Korui shochu · 25% ABV · 720 ml",
  "Seit 1977 im Sortiment, klar und mild mit einem Anteil fassgereifter Destillate.": "In the range since 1977, clean and mild with a proportion of barrel-aged distillates.",
  "Vollständig aus Süßkartoffeln, mit klarer Süße und elegantem Geschmack.": "Made entirely from sweet potatoes, with clean sweetness and an elegant taste.",
  "Imo Shōchū · 37 % Vol. · 720 ml": "Sweet potato shochu · 37% ABV · 720 ml",
  "Drei Jahre gereift und nach der Destillation ohne Wasserzugabe abgefüllt.": "Aged for three years and bottled after distillation without added water.",
  "Luzhou, Sichuan, China": "Luzhou, Sichuan, China",
  "Sorghum, Weizen, Wasser": "Sorghum, wheat, water",
  "Zugängliche Einstiegsabfüllung": "Accessible entry-level expression",
  "Klassischer Strong-Aroma-Baijiu": "Classic strong-aroma baijiu",
  "Ultra-High-End-Flaggschiff": "Ultra-high-end flagship",
  "Kasan, Tatarstan, Russland": "Kazan, Tatarstan, Russia",
  "Alpha-Getreidealkohol, Wasser": "Alpha-grade grain spirit, water",
  "Basislinie mit fünffach gefiltertem Wasser": "Core expression with five-times filtered water",
  "Botanischer Wodka": "Botanical vodka",
  "Alpha-Getreidealkohol, Wasser, Wacholder, Pinienkern, Zitronenöl": "Alpha-grade grain spirit, water, juniper, pine nut, lemon oil",
  "Botanische Mittelstufe": "Botanical middle tier",
  "Alpha-Getreidealkohol, Wasser, Kräuter, fünf aromatische Destillate": "Alpha-grade grain spirit, water, herbs, five aromatic distillates",
  "Kräuterbetonte Premiumabfüllung": "Herb-forward premium expression",
  "Kyōto, Japan": "Kyoto, Japan",
  "Kōrui Shōchū": "Korui shochu",
  "Getreidedestillat, fassgereifte Destillate, Wasser": "Grain distillate, barrel-aged distillates, water",
  "Seit 1977 etablierte Basisabfüllung": "Established core expression since 1977",
  "Süßkartoffeln, Süßkartoffel-Kōji, Wasser": "Sweet potatoes, sweet-potato koji, water",
  "Vollständig aus Süßkartoffeln": "Made entirely from sweet potatoes",
  "Lang gereifter Honkaku Imo Shōchū": "Long-aged honkaku sweet potato shochu",
  "Süßkartoffeln, Süßkartoffel-Kōji": "Sweet potatoes, sweet-potato koji",
  "37 % Vol.": "37% ABV",
  "Drei Jahre gereift, unverdünnt abgefüllt": "Aged for three years and bottled undiluted",
  "Baijiu · 53 % Vol. · 500 ml": "Baijiu · 53% ABV · 500 ml",
  "Baijiu · 40 % Vol. · 500 ml": "Baijiu · 40% ABV · 500 ml",
  "Baijiu · 52 % Vol. · 500 ml": "Baijiu · 52% ABV · 500 ml",
  "Premium Vodka": "Premium vodka",
  "Strong Aroma Baijiu": "Strong-aroma baijiu"
};

const translatableSelector = [
  ".detail-back",
  ".country-kicker",
  ".country-detail h2",
  ".country-subtitle",
  ".country-copy p",
  ".spirit-facts dt",
  ".spirit-facts dd",
  ".product-label",
  ".product-meta",
  ".product-description",
  ".availability",
  "table th",
  "table td"
].join(",");

const translatableElements = [...document.querySelectorAll(translatableSelector)];

for (const element of translatableElements) {
  element.dataset.deText = element.textContent.trim();
}

let language = "de";

const countryLabel = (country) => language === "en" ? countryNames[country] || country : country;

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

  controlsLabel?.setAttribute("aria-label", language === "en" ? "Language and appearance" : "Sprache und Darstellung");

  for (const element of translatableElements) {
    const german = element.dataset.deText;
    element.textContent = language === "en" ? english[german] || countryNames[german] || german : german;
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
