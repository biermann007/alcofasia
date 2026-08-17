// Worker vor den statischen Dateien.
//
// Die Seiten in public/ bleiben die Quelle für Layout, CSS und Bedienung. Der
// Worker setzt nur die Inhalte ein, die aus der Datenbank kommen, und beliefert
// den Adminbereich unter /admin.

import {
  renderCountryDetails,
  renderCountryColors,
  renderCountryNames,
  renderListHead,
  renderListRows,
  renderBuddhaLaender,
  renderBuddhaText,
  renderArenaLaender
} from "./render.js";
import { handleAdmin } from "./admin.js";
import { laenderOderLeer, buddhaTexteOderLeer, einstellungenOderStandard } from "./cache.js";

function seiteUmschreiben(response, ersetzungen, fehler) {
  let rewriter = new HTMLRewriter();
  for (const [selektor, html] of Object.entries(ersetzungen)) {
    rewriter = rewriter.on(selektor, {
      element(element) {
        element.setInnerContent(html, { html: true });
      }
    });
  }
  const umgeschrieben = rewriter.transform(response);
  if (!fehler) return umgeschrieben;

  // Sichtbar für die Fehlersuche, ohne den Besuchern etwas anzuzeigen.
  const kopf = new Headers(umgeschrieben.headers);
  kopf.set("x-alcofasia-daten", "nicht verfügbar");
  return new Response(umgeschrieben.body, { status: umgeschrieben.status, headers: kopf });
}

// alcofworld.com läuft über denselben Worker: die Wurzel zeigt die Weltseite
// aus public/world/, alles Übrige (CSS, Skripte, world.svg) kommt aus
// denselben Assets. Der Adminbereich bleibt allein auf alcofasia.com – dort
// liegt Cloudflare Access davor, auf alcofworld.com läge er ungeschützt.
const WELT_HOSTS = new Set(["alcofworld.com", "www.alcofworld.com"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pfad = url.pathname;

    if (WELT_HOSTS.has(url.hostname)) {
      if (pfad === "/admin" || pfad.startsWith("/admin/")) {
        return Response.redirect("https://alcofasia.com" + pfad, 308);
      }
      if (pfad === "/" || pfad === "/index.html" || pfad === "/world" || pfad === "/world/" || pfad === "/world/index.html") {
        // Die Weltseite direkt unter der nackten Adresse ausliefern. Der
        // Asset-Speicher beantwortet manche Pfadformen mit einer Umleitung
        // auf seine Schönschreibung (/world/index.html -> /world/); die wird
        // hier intern verfolgt statt an den Browser weitergegeben – sonst
        // springt die Adresszeile von alcofworld.com auf …/world/ um.
        let antwort = await env.ASSETS.fetch(new Request(new URL("/world/", url), request));
        for (let i = 0; i < 3 && antwort.status >= 300 && antwort.status < 400; i++) {
          const ziel = antwort.headers.get("location");
          if (!ziel) break;
          antwort = await env.ASSETS.fetch(new Request(new URL(ziel, url), request));
        }
        return antwort;
      }
      return env.ASSETS.fetch(request);
    }

    if (pfad === "/admin" || pfad.startsWith("/admin/")) {
      return handleAdmin(request, env);
    }

    const antwort = await env.ASSETS.fetch(request);

    if (pfad === "/" || pfad === "/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      const { einstellungen } = await einstellungenOderStandard(env);
      const optionen = { produkteAnzeigen: einstellungen.produkte_anzeigen };
      return seiteUmschreiben(antwort, {
        "[data-country-details]": renderCountryDetails(alle, optionen),
        "style[data-country-colors]": renderCountryColors(alle),
        "script[data-country-names]": renderCountryNames(alle)
      }, fehler);
    }

    if (pfad === "/list" || pfad === "/list/" || pfad === "/list/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      const { einstellungen } = await einstellungenOderStandard(env);
      const optionen = { produkteAnzeigen: einstellungen.produkte_anzeigen };
      return seiteUmschreiben(antwort, {
        "[data-list-head]": renderListHead(optionen, alle),
        "[data-list-rows]": renderListRows(alle, optionen),
        "script[data-country-names]": renderCountryNames(alle)
      }, fehler);
    }

    if (pfad === "/arena" || pfad === "/arena/" || pfad === "/arena/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      return seiteUmschreiben(antwort, {
        "script[data-arena-laender]": renderArenaLaender(alle)
      }, fehler);
    }

    if (pfad === "/buddha" || pfad === "/buddha/" || pfad === "/buddha/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      const { texte, fehler: buddhaFehler } = await buddhaTexteOderLeer(env);
      return seiteUmschreiben(antwort, {
        "[data-buddha-laender]": renderBuddhaLaender(alle),
        "[data-buddha-top3]": renderBuddhaText(texte.top3),
        "[data-buddha-empfehlung]": renderBuddhaText(texte.empfehlung)
      }, fehler || buddhaFehler);
    }

    return antwort;
  }
};
