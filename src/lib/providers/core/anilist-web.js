/**
 * Server side AniList GraphQL helper used by the streaming providers.
 *
 * The public GraphQL host (https://graphql.anilist.co) regularly refuses
 * requests coming from datacenter IPs such as Vercel's, which makes the
 * provider routes fail with 500s. When that happens we fall back to the
 * website's own GraphQL endpoint (https://anilist.co/graphql), which is
 * protected by a CSRF token instead of an IP allow list.
 *
 * The session (token + cookies) is cached for a short while so the homepage
 * only has to be fetched once in a while.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const GRAPHQL_ENDPOINT = "https://graphql.anilist.co";
const WEB_ENDPOINT = "https://anilist.co";
const WEB_GRAPHQL_ENDPOINT = `${WEB_ENDPOINT}/graphql`;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

let session = null;
let sessionExpiresAt = 0;
let inflightSession = null;

function cookiesFromHeaders(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => String(value).split(";")[0]).join("; ");
}

async function loadSession() {
  try {
    const home = await fetch(`${WEB_ENDPOINT}/`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!home?.ok) return null;

    const html = await home.text();
    const token = html.match(/window\.al_token\s*=\s*"([^"]+)"/)?.[1];
    const cookie = cookiesFromHeaders(home.headers);
    if (!token || !cookie) return null;

    return { token, cookie };
  } catch {
    return null;
  }
}

async function getSession() {
  if (session && sessionExpiresAt > Date.now()) return session;
  if (inflightSession) return inflightSession;

  inflightSession = (async () => {
    const loaded = await loadSession();
    if (loaded) {
      session = loaded;
      sessionExpiresAt = Date.now() + SESSION_TTL_MS;
    }
    inflightSession = null;
    return loaded;
  })();

  return inflightSession;
}

/**
 * Posts a GraphQL query to the website endpoint. Returns `null` when the
 * endpoint cannot be reached.
 */
export async function anilistGraphQLWeb(query, variables) {
  const current = await getSession();
  if (!current) return null;

  try {
    const res = await fetch(WEB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
        Referer: `${WEB_ENDPOINT}/home`,
        "x-csrf-token": current.token,
        schema: "default",
        Cookie: current.cookie,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;

    const json = await res.json();
    return json ?? null;
  } catch {
    return null;
  }
}

/**
 * Posts a GraphQL query to AniList and returns the parsed response body.
 *
 * The public GraphQL host is tried first, the website endpoint is used as a
 * fallback. `null` is returned when neither endpoint could be reached.
 */
export async function anilistGraphQL(query, variables) {
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json) return json;
    }
  } catch {
    // Fall through to the website endpoint.
  }

  return anilistGraphQLWeb(query, variables);
}
