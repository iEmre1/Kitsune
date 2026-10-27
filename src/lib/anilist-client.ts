"use client";

import {
  MEDIA_LIST_FRAGMENT,
  normalizeMediaList,
} from "@/lib/anilist-shared";
import {
  MediaFull,
  MediaList,
  PaginatedResponse,
  ScheduleItem,
  SearchSuggestionsResponse,
} from "@/types/miruro-api";
import { getPocketBaseAnimeIds } from "@/lib/pocketbase-anime";

/**
 * Client-side AniList cache. Network requests go through the same-origin API
 * route so browsers do not depend on AniList CORS behavior.
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DETAIL_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_MEM_ENTRIES = 150;
const STORAGE_PREFIX = "kitsune:anilist:v2:";
const STORAGE_MAX_ENTRIES = 60;
const STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IMAGE_CACHE_MS = 30 * 60 * 1000;

const memCache = new Map<string, { data: any; expiresAt: number }>();
const inflight = new Map<string, Promise<any>>();
const imageCache = new Map<
  number,
  { value: { poster: string | null; banner: string | null }; expiresAt: number }
>();

function setMemCache(key: string, data: any, expiresAt: number) {
  memCache.delete(key);
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
  memCache.set(key, { data, expiresAt });
}

/** Small, dependency free hash (FNV-1a) used for cache keys. */
function hashKey(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPersistedEntry(key: string): { data: any; expiresAt: number } | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    return { data: parsed.data, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function persistEntry(key: string, data: any, ttlMs: number) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify({ data, expiresAt: Date.now() + ttlMs }),
    );
    pruneStorage(storage);
  } catch {
    // Storage full / unavailable - the in-memory cache still works.
  }
}

function pruneStorage(storage: Storage) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    if (keys.length <= STORAGE_MAX_ENTRIES) return;

    const now = Date.now();
    const alive: string[] = [];
    keys.forEach((key) => {
      try {
        const parsed = JSON.parse(storage.getItem(key) || "null");
        if (!parsed?.expiresAt || parsed.expiresAt <= now) {
          storage.removeItem(key);
        } else {
          alive.push(key);
        }
      } catch {
        storage.removeItem(key);
      }
    });

    while (alive.length > STORAGE_MAX_ENTRIES) {
      const key = alive.shift();
      if (key) storage.removeItem(key);
    }
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Sends a GraphQL query to AniList through the same-origin API route.
 * Results are cached in memory (and in localStorage) to keep the request
 * count low and to survive short AniList outages.
 */
export async function anilistClientQuery<T = any>(
  query: string,
  variables: Record<string, any> = {},
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const rawKey = JSON.stringify({ query: query.trim(), variables });
  const storageKey = hashKey(rawKey);
  const now = Date.now();

  const isValidPayload = (d: any): boolean => {
    if (!d || typeof d !== "object") return false;
    if (variables.id !== undefined) {
      return Number(d.Media?.id) === Number(variables.id);
    }
    if ("Page" in d) return Boolean(d.Page);
    if ("Media" in d) return Boolean(d.Media);
    if ("MediaListCollection" in d) return Boolean(d.MediaListCollection);
    // Unknown shape - accept it as long as it is not empty.
    return Object.keys(d).length > 0;
  };

  // 1. In-memory cache
  const hit = memCache.get(rawKey);
  if (hit && hit.expiresAt > now && isValidPayload(hit.data)) {
    return hit.data as T;
  }

  // 2. localStorage cache (survives reloads)
  const persisted = readPersistedEntry(storageKey);
  if (persisted && persisted.expiresAt > now && isValidPayload(persisted.data)) {
    setMemCache(rawKey, persisted.data, persisted.expiresAt);
    return persisted.data as T;
  }

  // 3. Deduplicate concurrent requests with the same payload
  const pending = inflight.get(rawKey);
  if (pending) return pending as Promise<T>;

  const request = (async (): Promise<T> => {
    let response: Response;
    try {
      response = await fetch("/api/anilist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
    } catch (error: any) {
      const stale = getStaleFallback(storageKey, isValidPayload);
      if (stale) return stale as T;
      throw new Error(error?.message || "AniList API'ye ulaşılamadı", {
        cause: error,
      });
    }

    if (!response.ok) {
      const stale = getStaleFallback(storageKey, isValidPayload);
      if (stale) return stale as T;

      let message = `AniList API HTTP ${response.status}`;
      try {
        const body = await response.json();
        message = body?.errors?.[0]?.message || message;
      } catch {
        // Keep the generic message.
      }
      throw new Error(message);
    }

    const json = await response.json();
    if (json.errors?.length && !isValidPayload(json.data)) {
      throw new Error(json.errors[0]?.message || "AniList GraphQL error");
    }

    if (isValidPayload(json.data)) {
      setMemCache(rawKey, json.data, Date.now() + ttlMs);
      persistEntry(storageKey, json.data, ttlMs);
    }
    return json.data as T;
  })();

  inflight.set(rawKey, request);
  try {
    return await request;
  } finally {
    inflight.delete(rawKey);
  }
}

/**
 * Returns the last known payload when AniList is unreachable, so the page
 * still renders something instead of an empty error screen.
 */
function getStaleFallback(
  storageKey: string,
  isValidPayload: (data: any) => boolean,
): any | null {
  const persisted = readPersistedEntry(storageKey);
  if (!persisted) return null;
  if (Date.now() - persisted.expiresAt > STALE_MAX_AGE_MS) return null;
  return isValidPayload(persisted.data) ? persisted.data : null;
}

export async function fetchMediaPage(options: {
  page?: number;
  perPage?: number;
  sort?: string[];
  status?: string;
  season?: string;
  seasonYear?: number;
  format?: string;
  genre_in?: string[];
  tag_in?: string[];
  search?: string;
}): Promise<PaginatedResponse<MediaList>> {
  const page = Math.max(1, Number(options.page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(options.perPage) || 20));

  const query = `
    ${MEDIA_LIST_FRAGMENT}
    query (
      $page: Int
      $perPage: Int
      $sort: [MediaSort]
      $status: MediaStatus
      $season: MediaSeason
      $seasonYear: Int
      $format: MediaFormat
      $genre_in: [String]
      $tag_in: [String]
      $search: String
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          hasNextPage
        }
        media(
          type: ANIME
          isAdult: false
          sort: $sort
          status: $status
          season: $season
          seasonYear: $seasonYear
          format: $format
          genre_in: $genre_in
          tag_in: $tag_in
          search: $search
        ) {
          ...MediaListFields
        }
      }
    }
  `;

  const variables: Record<string, any> = {
    page,
    perPage,
    sort: options.sort?.length ? options.sort : ["POPULARITY_DESC"],
  };
  if (options.status) variables.status = options.status;
  if (options.season) variables.season = options.season;
  if (options.seasonYear) variables.seasonYear = options.seasonYear;
  if (options.format) variables.format = options.format;
  if (options.genre_in?.length) variables.genre_in = options.genre_in;
  if (options.tag_in?.length) variables.tag_in = options.tag_in;
  if (options.search) variables.search = options.search;

  const data = await anilistClientQuery(query, variables);
  const pageInfo = data?.Page?.pageInfo || {};
  const uniqueMedia = new Map<number, MediaList>();

  for (const item of (data?.Page?.media || []).map(normalizeMediaList)) {
    if (item.isAdult || !item.id) continue;
    const poster = item.coverImage?.extraLarge || item.coverImage?.large || "";
    if (!poster.trim()) continue;

    const existing = uniqueMedia.get(item.id);
    if (!existing || !existing.coverImage?.extraLarge || !existing.coverImage?.large) {
      uniqueMedia.set(item.id, item);
    }
  }

  const media = Array.from(uniqueMedia.values());

  return {
    page: pageInfo.currentPage || page,
    perPage: pageInfo.perPage || perPage,
    total: pageInfo.total || media.length,
    hasNextPage: Boolean(pageInfo.hasNextPage),
    results: media,
  };
}

export type HomepageAnimeData = {
  spotlight: MediaList[];
  recent: PaginatedResponse<MediaList>;
  popular: PaginatedResponse<MediaList>;
  trending: PaginatedResponse<MediaList>;
  upcoming: PaginatedResponse<MediaList>;
};

export async function fetchHomepageData(
  trendingPage = 1,
  upcomingPage = 1,
  perPage = 14,
): Promise<HomepageAnimeData> {
  const query = `
    ${MEDIA_LIST_FRAGMENT}
    query ($trendingPage: Int, $upcomingPage: Int, $perPage: Int) {
      spotlight: Page(page: 1, perPage: 15) {
        media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          ...MediaListFields
        }
      }
      recent: Page(page: 1, perPage: 20) {
        pageInfo { total perPage currentPage hasNextPage }
        media(type: ANIME, isAdult: false, status: RELEASING, sort: [UPDATED_AT_DESC, POPULARITY_DESC]) {
          ...MediaListFields
        }
      }
      popular: Page(page: 1, perPage: 20) {
        pageInfo { total perPage currentPage hasNextPage }
        media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
          ...MediaListFields
        }
      }
      trending: Page(page: $trendingPage, perPage: $perPage) {
        pageInfo { total perPage currentPage hasNextPage }
        media(type: ANIME, isAdult: false, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          ...MediaListFields
        }
      }
      upcoming: Page(page: $upcomingPage, perPage: $perPage) {
        pageInfo { total perPage currentPage hasNextPage }
        media(type: ANIME, isAdult: false, status: NOT_YET_RELEASED, sort: [POPULARITY_DESC]) {
          ...MediaListFields
        }
      }
    }
  `;
  const data = await anilistClientQuery<any>(query, {
    trendingPage,
    upcomingPage,
    perPage,
  });
  const toPage = (
    value: any,
    page: number,
    requestedPerPage: number,
  ): PaginatedResponse<MediaList> => {
    const pageInfo = value?.pageInfo || {};
    const results = (value?.media || [])
      .map(normalizeMediaList)
      .filter((item: MediaList) => !item.isAdult);
    return {
      page: pageInfo.currentPage || page,
      perPage: pageInfo.perPage || requestedPerPage,
      total: pageInfo.total || results.length,
      hasNextPage: Boolean(pageInfo.hasNextPage),
      results,
    };
  };
  const spotlightSeen = new Set<number>();
  const spotlight = (data?.spotlight?.media || [])
    .map(normalizeMediaList)
    .filter((item: MediaList) => {
      const poster = item.coverImage?.extraLarge || item.coverImage?.large || "";
      if (item.isAdult || !poster.trim() || spotlightSeen.has(item.id)) return false;
      spotlightSeen.add(item.id);
      return Boolean(item.bannerImage || poster);
    })
    .slice(0, 10);

  return {
    spotlight,
    recent: toPage(data?.recent, 1, 20),
    popular: toPage(data?.popular, 1, 20),
    trending: toPage(data?.trending, trendingPage, perPage),
    upcoming: toPage(data?.upcoming, upcomingPage, perPage),
  };
}

export async function fetchSpotlight(): Promise<{ results: MediaList[] }> {
  const pageData = await fetchMediaPage({
    page: 1,
    perPage: 15,
    sort: ["TRENDING_DESC", "POPULARITY_DESC"],
  });
  const seen = new Set<number>();
  const withBanner = pageData.results.filter((m) => {
    const poster = m.coverImage?.extraLarge || m.coverImage?.large || "";
    if (!poster.trim() || seen.has(m.id)) return false;
    seen.add(m.id);
    return Boolean(m.bannerImage || poster);
  });
  return { results: withBanner.slice(0, 10) };
}

export async function fetchSchedule(
  dateStr?: string,
  page = 1,
  perPage = 25,
): Promise<PaginatedResponse<ScheduleItem>> {
  let airingAtGreater: number;
  let airingAtLesser: number;

  if (dateStr) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T00:00:00Z`)
      : new Date(dateStr);
    const validStart = isNaN(parsed.getTime()) ? new Date() : parsed;
    validStart.setUTCHours(0, 0, 0, 0);
    airingAtGreater = Math.floor(validStart.getTime() / 1000) - 1;
    airingAtLesser = airingAtGreater + 86400;
  } else {
    airingAtGreater = Math.floor(Date.now() / 1000) - 3600;
    airingAtLesser = airingAtGreater + 86400 * 7;
  }

  const query = `
    ${MEDIA_LIST_FRAGMENT}
    query ($page: Int, $perPage: Int, $greater: Int, $lesser: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          hasNextPage
        }
        airingSchedules(
          airingAt_greater: $greater
          airingAt_lesser: $lesser
          sort: [TIME]
        ) {
          id
          episode
          airingAt
          timeUntilAiring
          media {
            ...MediaListFields
          }
        }
      }
    }
  `;

  const data = await anilistClientQuery(query, {
    page,
    perPage,
    greater: airingAtGreater,
    lesser: airingAtLesser,
  });

  const schedules = data?.Page?.airingSchedules || [];
  const results: ScheduleItem[] = schedules
    .filter((s: any) => s?.media && !s.media.isAdult)
    .map((s: any) => ({
      ...normalizeMediaList(s.media),
      next_episode: s.episode || 1,
      airingAt: s.airingAt || 0,
      timeUntilAiring: s.timeUntilAiring ?? 0,
    }));

  const pageInfo = data?.Page?.pageInfo || {};
  return {
    page: pageInfo.currentPage || page,
    perPage: pageInfo.perPage || perPage,
    total: pageInfo.total || results.length,
    hasNextPage: Boolean(pageInfo.hasNextPage),
    results,
  };
}

export async function fetchSuggestions(
  q: string,
): Promise<SearchSuggestionsResponse> {
  if (!q.trim()) return { suggestions: [] };
  const pageData = await fetchMediaPage({
    page: 1,
    perPage: 8,
    search: q.trim(),
    sort: ["SEARCH_MATCH", "POPULARITY_DESC"],
  });

  return {
    suggestions: pageData.results.map((m) => ({
      id: m.id,
      title: m.title.english || m.title.romaji || m.title.native || "Untitled",
      title_romaji: m.title.romaji || null,
      poster: m.coverImage.extraLarge || m.coverImage.large || "",
      format: m.format || null,
      status: m.status || null,
      year: m.seasonYear || m.startDate?.year || null,
      episodes:
        m.episodes ?? (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
    })),
  };
}

/**
 * Full detail payload for a single anime (overview tab of the detail page).
 */
export async function fetchAnimeImages(id: number): Promise<{
  poster: string | null;
  banner: string | null;
}> {
  return (await fetchAnimeImagesForIds([id])).get(id) || {
    poster: null,
    banner: null,
  };
}

export async function fetchAnimeImagesForIds(ids: number[]) {
  const validIds = Array.from(new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0)));
  if (!validIds.length) return new Map<number, { poster: string | null; banner: string | null }>();

  const now = Date.now();
  const images = new Map<number, { poster: string | null; banner: string | null }>();
  const missingIds: number[] = [];

  for (const id of validIds) {
    const cached = imageCache.get(id);
    if (cached && cached.expiresAt > now) images.set(id, cached.value);
    else missingIds.push(id);
  }

  if (!missingIds.length) return images;

  const response = await fetch("/api/anime/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: missingIds }),
  });
  if (!response.ok) throw new Error(`Anime görselleri alınamadı (${response.status})`);

  const payload = (await response.json()) as {
    images?: Array<{ id: number; poster: string | null; banner: string | null }>;
  };
  const received = new Map((payload.images || []).map((image) => [Number(image.id), image]));

  for (const id of missingIds) {
    const image = received.get(id) || { id, poster: null, banner: null };
    const value = { poster: image.poster, banner: image.banner };
    imageCache.set(id, { value, expiresAt: now + IMAGE_CACHE_MS });
    images.set(id, value);
  }

  return images;
}

export async function fetchAnimeRelations(id: number): Promise<
  Array<{ id: number; relationType: string; year: number | null; title: string }>
> {
  if (!Number.isSafeInteger(id) || id <= 0) return [];

  const response = await fetch(`/api/anime/relations?id=${id}`);
  if (!response.ok) throw new Error(`Anime ilişkileri alınamadı (${response.status})`);
  const payload = (await response.json()) as {
    relations?: Array<{
      id: number;
      relationType: string;
      year: number | null;
      title: string;
    }>;
  };
  return payload.relations || [];
}

export async function fetchAnimeInfo(id: number): Promise<MediaFull | null> {
  if (!id || isNaN(id)) return null;

  const query = `
    ${MEDIA_LIST_FRAGMENT}
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ...MediaListFields
        idMal
        description(asHtml: false)
        trending
        hashtag
        synonyms
        siteUrl
        tags {
          name
          rank
          isMediaSpoiler
        }
        trailer {
          id
          site
          thumbnail
        }
        characters(sort: [ROLE, RELEVANCE, ID], perPage: 18) {
          edges {
            role
            node {
              id
              name {
                full
                native
                userPreferred
              }
              image {
                large
                medium
              }
            }
            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
              id
              name {
                full
                native
              }
              image {
                large
              }
              languageV2
            }
          }
        }
        staff(perPage: 8) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              image {
                large
              }
            }
          }
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                extraLarge
                color
              }
              bannerImage
              format
              type
              status
              episodes
              meanScore
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
            }
          }
        }
        recommendations(sort: [RATING_DESC], perPage: 14) {
          nodes {
            rating
            mediaRecommendation {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                extraLarge
                color
              }
              bannerImage
              format
              episodes
              status
              meanScore
              averageScore
              popularity
              genres
              startDate {
                year
              }
            }
          }
        }
        externalLinks {
          url
          site
          type
        }
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        stats {
          scoreDistribution {
            score
            amount
          }
          statusDistribution {
            status
            amount
          }
        }
      }
    }
  `;

  const data = await anilistClientQuery(query, { id }, DETAIL_TTL_MS);
  const raw = data?.Media;
  if (!raw) return null;

  const base = normalizeMediaList(raw);
  return {
    ...base,
    idMal: raw.idMal ?? null,
    description: raw.description ?? "",
    trending: raw.trending || 0,
    tags: raw.tags || [],
    hashtag: raw.hashtag || null,
    synonyms: raw.synonyms || [],
    siteUrl: raw.siteUrl || "",
    trailer: raw.trailer || null,
    characters: { edges: raw.characters?.edges || [] },
    staff: { edges: raw.staff?.edges || [] },
    relations: {
      edges: (raw.relations?.edges || []).filter(
        (e: any) => !e?.node?.type || e.node.type === "ANIME",
      ),
    },
    recommendations: { nodes: raw.recommendations?.nodes || [] },
    externalLinks: raw.externalLinks || [],
    streamingEpisodes: raw.streamingEpisodes || [],
    stats: raw.stats || { scoreDistribution: [], statusDistribution: [] },
  };
}
