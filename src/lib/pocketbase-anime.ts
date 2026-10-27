import { pb } from "@/lib/pocketbase";

export type PBAnimeRecord = Record<string, any> & {
  id: string;
  anilist_id?: number | string;
  animecix_id?: number | string;
  name?: string;
  name_english?: string;
  name_romaji?: string;
  original_title?: string;
  season_count?: number | string;
  release_date?: string;
  poster?: string;
  banner?: string;
};

export type AnimeSeasonOption = {
  value: string;
  label: string;
  seasonNumber?: number;
};

let catalogCache: { expiresAt: number; records: PBAnimeRecord[] } | null = null;
let catalogRequest: Promise<PBAnimeRecord[]> | null = null;

export async function getPocketBaseAnimeCatalog(): Promise<PBAnimeRecord[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.records;
  }
  if (catalogRequest) return catalogRequest;

  catalogRequest = pb
    .collection("animes")
    .getFullList<PBAnimeRecord>({ requestKey: null })
    .then((records) => {
      catalogCache = { records, expiresAt: Date.now() + 5 * 60 * 1000 };
      return records;
    })
    .catch(() => [])
    .finally(() => {
      catalogRequest = null;
    });

  return catalogRequest;
}

export async function getPocketBaseAnimeByAniListId(
  anilistId: string | number,
  fields?: string,
): Promise<PBAnimeRecord | null> {
  const id = Number(anilistId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const options = {
    ...(fields ? { fields } : {}),
    requestKey: null,
  };
  for (const filter of [`anilist_id = "${id}"`, `anilist_id = ${id}`]) {
    try {
      return await pb.collection("animes").getFirstListItem<PBAnimeRecord>(filter, options);
    } catch {
      // Imported records may use either text or numeric AniList ID fields.
    }
  }

  return null;
}

export async function getPocketBaseAnimeRecordsByAniListId(
  anilistId: string | number,
): Promise<PBAnimeRecord[]> {
  const id = Number(anilistId);
  if (!Number.isSafeInteger(id) || id <= 0) return [];

  const catalog = await getPocketBaseAnimeCatalog();
  return catalog.filter((anime) => Number(anime.anilist_id) === id);
}

export function getPocketBaseImageUrl(
  record: PBAnimeRecord,
  value: unknown,
): string {
  const image = Array.isArray(value) ? value[0] : value;
  if (typeof image !== "string" || !image.trim()) return "/icon.png";

  const path = image.trim();
  if (/^(https?:)?\/\//i.test(path) || /^(data|blob):/i.test(path)) {
    return path;
  }
  if (/^\/?api\/files\//i.test(path)) {
    return `${pb.baseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
  }
  if (path.startsWith("/")) return path;

  return pb.files.getURL(record, path);
}

function animeTitle(anime: PBAnimeRecord): string {
  return (
    anime.name_english ||
    anime.name ||
    anime.name_romaji ||
    anime.original_title ||
    ""
  ).trim();
}

function seasonTitle(anime: PBAnimeRecord): string {
  const titles = [
    anime.name_english,
    anime.name,
    anime.name_romaji,
    anime.original_title,
  ].filter((title): title is string => typeof title === "string" && !!title.trim());
  return (
    titles.find((title) =>
      /(?:\bseason\s*\d+|\b\d+(?:st|nd|rd|th)\s+season|\bs\d+|\bpart\s*\d+|\bfinal\s+season)\s*$/i.test(
        title,
      ) || /\s+\d+\s*$/i.test(title),
    ) || animeTitle(anime)
  );
}

export function getAnimeSeasonNumber(anime: PBAnimeRecord): number | null {
  const match = seasonTitle(anime).match(
    /(?:\bseason\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)\s+season\b|\bs(\d+)\b|\bpart\s*(\d+)\b|\s+(\d+))\s*$/i,
  );
  const fromTitle = match
    ? Number(match[1] || match[2] || match[3] || match[4] || match[5])
    : 0;
  const fromSeasonField = Number(anime.season_number) || 0;
  return fromTitle || fromSeasonField || null;
}

export function getAnimeSeriesTitle(anime: PBAnimeRecord): string {
  return seasonTitle(anime)
    .replace(
      /(?:\s*[-:–]?\s*(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season|s\d+|part\s*\d+|final\s+season|\d+))\s*$/i,
      "",
    )
    .replace(/\bthe\s*$/i, "")
    .trim();
}

export function getAnimeSeriesKey(anime: PBAnimeRecord): string {
  return getAnimeSeriesTitle(anime)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function orderedSeasons(records: PBAnimeRecord[]): PBAnimeRecord[] {
  return [...records].sort((left, right) => {
    const leftNumber = getAnimeSeasonNumber(left) ?? Number.MAX_SAFE_INTEGER;
    const rightNumber = getAnimeSeasonNumber(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return (left.release_date || "").localeCompare(right.release_date || "");
  });
}

export async function getAnimeSeasonOptions(
  anilistId: string,
): Promise<AnimeSeasonOption[]> {
  const id = Number(anilistId);
  if (!Number.isSafeInteger(id) || id <= 0) return [];

  const catalog = await getPocketBaseAnimeCatalog();
  const current = catalog.find((anime) => Number(anime.anilist_id) === id);
  if (!current) return [];

  const key = getAnimeSeriesKey(current);
  const seasons = orderedSeasons(
    catalog.filter((anime) => getAnimeSeriesKey(anime) === key && Number(anime.anilist_id)),
  );
  const numbered = seasons.map(getAnimeSeasonNumber);
  const hasDuplicateNumbers =
    numbered.filter((number) => number !== null).length !==
    new Set(numbered.filter((number) => number !== null)).size;

  return seasons.map((anime, index) => {
    const number = getAnimeSeasonNumber(anime);
    return {
      value: String(anime.anilist_id),
      label:
        number && !hasDuplicateNumbers
          ? `Sezon ${number}`
          : `Sezon ${index + 1}`,
          seasonNumber: number || index + 1,
    };
  });
}

export async function getPocketBaseAnimeIds(): Promise<Set<number>> {
  const catalog = await getPocketBaseAnimeCatalog();
  const groups = new Map<string, PBAnimeRecord[]>();

  for (const anime of catalog) {
    const id = Number(anime.anilist_id);
    const key = getAnimeSeriesKey(anime);
    if (!id || !key) continue;
    const group = groups.get(key) || [];
    group.push(anime);
    groups.set(key, group);
  }

  return new Set(
    Array.from(groups.values()).map((group) =>
      Number(orderedSeasons(group)[0].anilist_id),
    ),
  );
}