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
  renderListRows
} from "./render.js";
import { handleAdmin } from "./admin.js";
import { laenderMitCache } from "./cache.js";

function seiteUmschreiben(response, ersetzungen) {
  let rewriter = new HTMLRewriter();
  for (const [selektor, html] of Object.entries(ersetzungen)) {
    rewriter = rewriter.on(selektor, {
      element(element) {
        element.setInnerContent(html, { html: true });
      }
    });
  }
  return rewriter.transform(response);
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
      const alle = await laenderMitCache(env);
      return seiteUmschreiben(antwort, {
        "[data-country-details]": renderCountryDetails(alle),
        "style[data-country-colors]": renderCountryColors(alle),
        "script[data-country-names]": renderCountryNames(alle)
      });
    }

    if (pfad === "/list" || pfad === "/list/" || pfad === "/list/index.html") {
      const alle = await laenderMitCache(env);
      return seiteUmschreiben(antwort, {
        "[data-list-head]": renderListHead(),
        "[data-list-rows]": renderListRows(alle),
        "script[data-country-names]": renderCountryNames(alle)
      });
    }

    return antwort;
  }
};
