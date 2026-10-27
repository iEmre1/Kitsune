/**
 * Translation layer between the URL/filter parameters used by the UI and the
 * AniList GraphQL arguments. It is browser safe so both the client side
 * queries and (optionally) the API routes can use it.
 */

export const STATUS_MAP: Record<string, string> = {
  "FINISHED-AIRING": "FINISHED",
  FINISHED: "FINISHED",
  "CURRENTLY-AIRING": "RELEASING",
  RELEASING: "RELEASING",
  "NOT-YET-AIRED": "NOT_YET_RELEASED",
  NOT_YET_RELEASED: "NOT_YET_RELEASED",
  CANCELLED: "CANCELLED",
  HIATUS: "HIATUS",
};

export const FORMAT_MAP: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV_SHORT",
  MOVIE: "MOVIE",
  SPECIAL: "SPECIAL",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "MUSIC",
};

export const SEASON_MAP: Record<string, string> = {
  WINTER: "WINTER",
  SPRING: "SPRING",
  SUMMER: "SUMMER",
  FALL: "FALL",
};

export const SORT_MAP: Record<string, string[]> = {
  "RECENTLY-ADDED": ["START_DATE_DESC"],
  RECENTLY_ADDED: ["START_DATE_DESC"],
  "RECENTLY-UPDATED": ["UPDATED_AT_DESC"],
  RECENTLY_UPDATED: ["UPDATED_AT_DESC"],
  SCORE: ["SCORE_DESC"],
  SCORE_DESC: ["SCORE_DESC"],
  "NAME-A-Z": ["TITLE_ROMAJI"],
  NAME_A_Z: ["TITLE_ROMAJI"],
  TITLE_ROMAJI: ["TITLE_ROMAJI"],
  "RELEASED-DATE": ["START_DATE_DESC"],
  RELEASED_DATE: ["START_DATE_DESC"],
  "MOST-WATCHED": ["POPULARITY_DESC"],
  MOST_WATCHED: ["POPULARITY_DESC"],
  POPULARITY: ["POPULARITY_DESC"],
  POPULARITY_DESC: ["POPULARITY_DESC"],
  TRENDING: ["TRENDING_DESC"],
  TRENDING_DESC: ["TRENDING_DESC"],
  FAVOURITES: ["FAVOURITES_DESC"],
  FAVOURITES_DESC: ["FAVOURITES_DESC"],
};

export const GENRE_OR_TAG_MAP: Record<string, { genre?: string; tag?: string }> = {
  action: { genre: "Action" },
  adventure: { genre: "Adventure" },
  comedy: { genre: "Comedy" },
  drama: { genre: "Drama" },
  ecchi: { genre: "Ecchi" },
  fantasy: { genre: "Fantasy" },
  horror: { genre: "Horror" },
  mecha: { genre: "Mecha" },
  music: { genre: "Music" },
  mystery: { genre: "Mystery" },
  psychological: { genre: "Psychological" },
  romance: { genre: "Romance" },
  "sci-fi": { genre: "Sci-Fi" },
  scifi: { genre: "Sci-Fi" },
  "slice-of-life": { genre: "Slice of Life" },
  sports: { genre: "Sports" },
  supernatural: { genre: "Supernatural" },
  thriller: { genre: "Thriller" },
  dementia: { genre: "Psychological" },
  cars: { tag: "Cars" },
  demons: { tag: "Demons" },
  game: { tag: "Video Games" },
  harem: { tag: "Female Harem" },
  historical: { tag: "Historical" },
  isekai: { tag: "Isekai" },
  josei: { tag: "Josei" },
  kids: { tag: "Kids" },
  magic: { tag: "Magic" },
  "martial-arts": { tag: "Martial Arts" },
  military: { tag: "Military" },
  parody: { tag: "Parody" },
  police: { tag: "Police" },
  samurai: { tag: "Samurai" },
  school: { tag: "School" },
  seinen: { tag: "Seinen" },
  shoujo: { tag: "Shoujo" },
  "shoujo ai": { tag: "Yuri" },
  shounen: { tag: "Shounen" },
  "shounen ai": { tag: "Boys' Love" },
  space: { tag: "Space" },
  "super-power": { tag: "Super Power" },
  vampire: { tag: "Vampire" },
};

export interface MediaFilterParams {
  page?: number;
  perPage?: number;
  query?: string;
  genres?: string;
  season?: string;
  format?: string;
  status?: string;
  sort?: string;
}

export interface MediaFilterOptions {
  page: number;
  perPage: number;
  search?: string;
  genre_in?: string[];
  tag_in?: string[];
  season?: string;
  format?: string;
  status?: string;
  sort: string[];
}

/**
 * Converts the raw filter parameters (as they come from the search page) into
 * the options accepted by `fetchMediaPage`.
 */
export function buildMediaFilterOptions(
  params: MediaFilterParams,
): MediaFilterOptions {
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = Math.min(50, Math.max(1, Number(params.perPage) || 20));
  const query = (params.query || "").trim();

  const items = (params.genres || "")
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  const genre_in: string[] = [];
  const tag_in: string[] = [];

  for (const item of items) {
    const mapped = GENRE_OR_TAG_MAP[item];
    if (mapped) {
      if (mapped.genre && !genre_in.includes(mapped.genre)) genre_in.push(mapped.genre);
      if (mapped.tag && !tag_in.includes(mapped.tag)) tag_in.push(mapped.tag);
    } else {
      const titleCase = item
        .split(/[\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      tag_in.push(titleCase);
    }
  }

  const rawSeason = (params.season || "").trim().toUpperCase();
  const season = SEASON_MAP[rawSeason] || undefined;

  const rawFormat = (params.format || "").trim().toUpperCase();
  const format = FORMAT_MAP[rawFormat] || undefined;

  const rawStatus = (params.status || "").trim().toUpperCase();
  const status = STATUS_MAP[rawStatus] || undefined;

  const rawSort = (params.sort || "").trim().toUpperCase();
  const sort = SORT_MAP[rawSort]
    ? SORT_MAP[rawSort]
    : query
      ? ["SEARCH_MATCH", "POPULARITY_DESC"]
      : ["POPULARITY_DESC"];

  return {
    page,
    perPage,
    search: query || undefined,
    genre_in: genre_in.length ? genre_in : undefined,
    tag_in: tag_in.length ? tag_in : undefined,
    season,
    format,
    status,
    sort,
  };
}
