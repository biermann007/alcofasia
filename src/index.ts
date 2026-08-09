interface Env {
  ASSETS: Fetcher;
  CONTENT_DB: D1Database;
  ADMIN_EMAIL?: string;
}

interface CountryContent {
  key: string;
  [key: string]: unknown;
}

interface ContentDocument {
  version: number;
  generatedAt?: string;
  countries: CountryContent[];
}

interface CountryOverrideRow {
  country_key: string;
  data: string | null;
  deleted: number;
  updated_at: string;
}

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
};
const MAX_BODY_BYTES = 256 * 1024;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { ...JSON_HEADERS, ...headers } }
);

const readBundledContent = async (request: Request, env: Env): Promise<ContentDocument> => {
  const url = new URL("/content.json", request.url);
  const response = await env.ASSETS.fetch(new Request(url, { headers: request.headers }));

  if (!response.ok) {
    throw new Error(`Bundled content could not be loaded (${response.status})`);
  }

  return response.json<ContentDocument>();
};

const readContent = async (request: Request, env: Env): Promise<ContentDocument> => {
  const bundled = await readBundledContent(request, env);
  const result = await env.CONTENT_DB.prepare(
    "SELECT country_key, data, deleted, updated_at FROM country_overrides ORDER BY country_key"
  ).all<CountryOverrideRow>();
  const countries = new Map(bundled.countries.map((country) => [country.key, country]));
  let latestUpdate = bundled.generatedAt;

  for (const row of result.results) {
    latestUpdate = row.updated_at;

    if (row.deleted === 1) {
      countries.delete(row.country_key);
      continue;
    }

    if (row.data) {
      const country = JSON.parse(row.data) as CountryContent;
      countries.set(row.country_key, country);
    }
  }

  return {
    version: bundled.version,
    generatedAt: latestUpdate,
    countries: [...countries.values()]
  };
};

const isLocalRequest = (request: Request) => {
  const hostname = new URL(request.url).hostname;
  const host = request.headers.get("Host") ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
};

const isAdmin = (request: Request, env: Env) => {
  if (isLocalRequest(request)) {
    return true;
  }

  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  return Boolean(env.ADMIN_EMAIL && email && assertion && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase());
};

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
};

const readCountryBody = async (request: Request, expectedKey: string): Promise<CountryContent> => {
  const contentType = request.headers.get("Content-Type") ?? "";
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);

  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Response("JSON required", { status: 415 });
  }

  if (contentLength > MAX_BODY_BYTES) {
    throw new Response("Request too large", { status: 413 });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Response("Request too large", { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Response("Country object required", { status: 400 });
  }

  const country = body as CountryContent;
  if (country.key !== expectedKey || expectedKey.length < 2 || expectedKey.length > 80) {
    throw new Response("Invalid country key", { status: 400 });
  }

  if (!country.name || !country.title || !Array.isArray(country.paragraphs) || !Array.isArray(country.facts) || !Array.isArray(country.manufacturers)) {
    throw new Response("Country data is incomplete", { status: 400 });
  }

  return country;
};

const handleApi = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);

  if (url.pathname === "/api/countries" && request.method === "GET") {
    return json(await readContent(request, env));
  }

  const match = url.pathname.match(/^\/api\/admin\/countries\/([^/]+)$/);
  if (!match) {
    return json({ error: "Not found" }, 404);
  }

  if (!isAdmin(request, env)) {
    return json({ error: "Admin access required" }, 401);
  }

  if (!sameOrigin(request)) {
    return json({ error: "Invalid origin" }, 403);
  }

  const countryKey = decodeURIComponent(match[1]);

  if (request.method === "PUT") {
    const country = await readCountryBody(request, countryKey);
    const updatedAt = new Date().toISOString();

    await env.CONTENT_DB.prepare(
      `INSERT INTO country_overrides (country_key, data, deleted, updated_at)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(country_key) DO UPDATE SET data = excluded.data, deleted = 0, updated_at = excluded.updated_at`
    ).bind(countryKey, JSON.stringify(country), updatedAt).run();

    return json({ country, updatedAt });
  }

  if (request.method === "DELETE") {
    const updatedAt = new Date().toISOString();

    await env.CONTENT_DB.prepare(
      `INSERT INTO country_overrides (country_key, data, deleted, updated_at)
       VALUES (?, NULL, 1, ?)
       ON CONFLICT(country_key) DO UPDATE SET data = NULL, deleted = 1, updated_at = excluded.updated_at`
    ).bind(countryKey, updatedAt).run();

    return json({ deleted: countryKey, updatedAt });
  }

  return json({ error: "Method not allowed" }, 405, { Allow: "PUT, DELETE" });
};

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await handleApi(request, env);
    } catch (error) {
      if (error instanceof Response) {
        return json({ error: await error.text() }, error.status);
      }

      console.error("API request failed", {
        path: new URL(request.url).pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error)
      });
      return json({ error: "Server error" }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
