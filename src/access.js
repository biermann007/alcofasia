// Prüfung der Cloudflare-Access-Anmeldung.
//
// Access hängt vor jeder erlaubten Anfrage das Cookie CF_Authorization bzw. den
// Header Cf-Access-Jwt-Assertion an. Cloudflare prüft den Token bereits am Rand
// des Netzes; der Worker prüft ihn ein zweites Mal selbst. Das kostet fast
// nichts und verhindert, dass eine falsch gesetzte Access-Regel den
// Adminbereich unbemerkt öffnet.

const CERT_CACHE_MS = 60 * 60 * 1000;
let certCache = { zeit: 0, teamDomain: null, schluessel: null };

const base64UrlDecode = (input) => {
  const normalisiert = input.replaceAll("-", "+").replaceAll("_", "/");
  const gefuellt = normalisiert.padEnd(normalisiert.length + ((4 - (normalisiert.length % 4)) % 4), "=");
  const binaer = atob(gefuellt);
  return Uint8Array.from(binaer, (c) => c.charCodeAt(0));
};

const jsonAusBase64Url = (input) => JSON.parse(new TextDecoder().decode(base64UrlDecode(input)));

async function schluesselLaden(teamDomain) {
  const jetzt = Date.now();
  if (certCache.schluessel && certCache.teamDomain === teamDomain && jetzt - certCache.zeit < CERT_CACHE_MS) {
    return certCache.schluessel;
  }

  const antwort = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!antwort.ok) throw new Error(`Access-Zertifikate nicht abrufbar (${antwort.status})`);
  const { keys } = await antwort.json();

  const schluessel = new Map();
  for (const jwk of keys ?? []) {
    schluessel.set(
      jwk.kid,
      await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
    );
  }

  certCache = { zeit: jetzt, teamDomain, schluessel };
  return schluessel;
}

/**
 * Gibt die angemeldete E-Mail-Adresse zurück oder wirft mit einer Begründung.
 */
export async function angemeldeterBenutzer(request, env) {
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;

  if (!teamDomain || !aud) {
    throw new Error(
      "Adminbereich ist nicht abgesichert: ACCESS_TEAM_DOMAIN und ACCESS_AUD fehlen. " +
        "Bitte zuerst die Cloudflare-Access-Anwendung anlegen und beide Werte setzen."
    );
  }

  const cookie = request.headers.get("Cookie") ?? "";
  const ausCookie = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get("Cf-Access-Jwt-Assertion") ?? ausCookie;

  if (!token) throw new Error("Keine Access-Anmeldung gefunden.");

  const [kopfB64, nutzdatenB64, signaturB64] = token.split(".");
  if (!kopfB64 || !nutzdatenB64 || !signaturB64) throw new Error("Access-Token ist unvollständig.");

  const kopf = jsonAusBase64Url(kopfB64);
  const nutzdaten = jsonAusBase64Url(nutzdatenB64);

  const schluessel = await schluesselLaden(teamDomain);
  const schluesselFuerKid = schluessel.get(kopf.kid);
  if (!schluesselFuerKid) throw new Error("Access-Token verweist auf einen unbekannten Schlüssel.");

  const gueltig = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    schluesselFuerKid,
    base64UrlDecode(signaturB64),
    new TextEncoder().encode(`${kopfB64}.${nutzdatenB64}`)
  );
  if (!gueltig) throw new Error("Signatur des Access-Tokens ist ungültig.");

  const jetzt = Math.floor(Date.now() / 1000);
  if (nutzdaten.exp && nutzdaten.exp < jetzt) throw new Error("Access-Token ist abgelaufen.");
  if (nutzdaten.nbf && nutzdaten.nbf > jetzt) throw new Error("Access-Token ist noch nicht gültig.");

  const zielgruppen = Array.isArray(nutzdaten.aud) ? nutzdaten.aud : [nutzdaten.aud];
  if (!zielgruppen.includes(aud)) throw new Error("Access-Token gehört zu einer anderen Anwendung.");

  if (nutzdaten.iss && nutzdaten.iss !== `https://${teamDomain}`) {
    throw new Error("Access-Token stammt von einer anderen Organisation.");
  }

  return nutzdaten.email ?? nutzdaten.sub ?? "unbekannt";
}
