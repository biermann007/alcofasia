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
  renderBuddhaText
} from "./render.js";
import { handleAdmin } from "./admin.js";
import { laenderOderLeer, buddhaTexteOderLeer } from "./cache.js";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pfad = url.pathname;

    if (pfad === "/admin" || pfad.startsWith("/admin/")) {
      return handleAdmin(request, env);
    }

    const antwort = await env.ASSETS.fetch(request);

    if (pfad === "/" || pfad === "/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      return seiteUmschreiben(antwort, {
        "[data-country-details]": renderCountryDetails(alle),
        "style[data-country-colors]": renderCountryColors(alle),
        "script[data-country-names]": renderCountryNames(alle)
      }, fehler);
    }

    if (pfad === "/list" || pfad === "/list/" || pfad === "/list/index.html") {
      const { laender: alle, fehler } = await laenderOderLeer(env);
      return seiteUmschreiben(antwort, {
        "[data-list-head]": renderListHead(),
        "[data-list-rows]": renderListRows(alle),
        "script[data-country-names]": renderCountryNames(alle)
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
