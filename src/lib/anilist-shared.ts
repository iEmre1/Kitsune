import { MediaList } from "@/types/miruro-api";

/**
 * AniList GraphQL endpoint.
 * GraphQL requests are sent through the same-origin API route; keep this
 * shared schema module free of Node.js-only dependencies.
 */
export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export const MEDIA_LIST_FRAGMENT = `
  fragment MediaListFields on Media {
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
    season
    seasonYear
    episodes
    duration
    status
    averageScore
    meanScore
    popularity
    favourites
    genres
    source
    countryOfOrigin
    isAdult
    studios(isMain: true) {
      nodes {
        id
        name
        isAnimationStudio
        siteUrl
      }
    }
    nextAiringEpisode {
      episode
      airingAt
      timeUntilAiring
    }
    startDate {
      year
      month
      day
    }
    endDate {
      year
      month
      day
    }
  }
`;

export function normalizeMediaList(raw: any): MediaList {
  return {
    id: Number(raw?.id) || 0,
    title: {
      romaji: raw?.title?.romaji || raw?.title?.english || "Untitled",
      english: raw?.title?.english || null,
      native: raw?.title?.native || null,
    },
    coverImage: {
      large: raw?.coverImage?.large || raw?.coverImage?.extraLarge || "",
      extraLarge: raw?.coverImage?.extraLarge || raw?.coverImage?.large || "",
      color: raw?.coverImage?.color || null,
    },
    bannerImage: raw?.bannerImage || null,
    format: raw?.format || "TV",
    season: raw?.season || null,
    seasonYear: raw?.seasonYear ?? raw?.startDate?.year ?? null,
    episodes: raw?.episodes ?? null,
    duration: raw?.duration ?? null,
    status: raw?.status || "FINISHED",
    averageScore: raw?.averageScore ?? null,
    meanScore: raw?.meanScore ?? null,
    popularity: raw?.popularity || 0,
    favourites: raw?.favourites || 0,
    genres: Array.isArray(raw?.genres) ? raw.genres : [],
    source: raw?.source || null,
    countryOfOrigin: raw?.countryOfOrigin || "JP",
    isAdult: Boolean(raw?.isAdult),
    studios: {
      nodes: Array.isArray(raw?.studios?.nodes) ? raw.studios.nodes : [],
    },
    nextAiringEpisode: raw?.nextAiringEpisode || null,
    startDate: raw?.startDate || { year: null, month: null, day: null },
    endDate: raw?.endDate || { year: null, month: null, day: null },
  };
}
