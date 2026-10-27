import { ANILIST_ENDPOINT } from "@/lib/anilist-shared";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const responseCache = new Map<
  string,
  { body: string; contentType: string; expiresAt: number }
>();
const inFlightRequests = new Map<
  string,
  Promise<{ body: string; contentType: string; status: number }>
>();

export async function POST(request: Request) {
  let payload: { query?: unknown; variables?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ errors: [{ message: "Geçersiz istek gövdesi" }] }, { status: 400 });
  }

  if (
    typeof payload.query !== "string" ||
    payload.query.length > 50_000 ||
    (payload.variables !== undefined &&
      (!payload.variables || typeof payload.variables !== "object" || Array.isArray(payload.variables)))
  ) {
    return Response.json({ errors: [{ message: "Geçersiz AniList sorgusu" }] }, { status: 400 });
  }

  const key = JSON.stringify({ query: payload.query, variables: payload.variables || {} });
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return new Response(cached.body, {
      headers: { "Content-Type": cached.contentType, "Cache-Control": "private, no-store" },
    });
  }

  try {
    let request = inFlightRequests.get(key);
    if (!request) {
      request = fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: payload.query,
          variables: payload.variables || {},
        }),
        cache: "no-store",
      }).then(async (upstream) => ({
        body: await upstream.text(),
        contentType: upstream.headers.get("content-type") || "application/json",
        status: upstream.status,
      }));
      inFlightRequests.set(key, request);
    }

    const result = await request;
    if (result.status === 200) {
      if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }
      responseCache.set(key, {
        body: result.body,
        contentType: result.contentType,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }
    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ errors: [{ message: "AniList servisine ulaşılamadı" }] }, { status: 502 });
  } finally {
    inFlightRequests.delete(key);
  }
}