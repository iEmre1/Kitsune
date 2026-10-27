"use client";

import { SEARCH_ANIME } from "@/constants/query-keys";
import { fetchAnimeImagesForIds } from "@/lib/anilist-client";
import {
  getAnimeSeriesTitle,
  getPocketBaseImageUrl,
  getPocketBaseAnimeCatalog,
  getPocketBaseAnimeIds,
} from "@/lib/pocketbase-anime";
import { IAnimeSearch, SearchAnimeParams } from "@/types/anime";
import { useQuery } from "@tanstack/react-query";

const searchAnime = async (params: SearchAnimeParams): Promise<IAnimeSearch> => {
  const cleanQuery = params.q ? params.q.replace(/^"+|"+$/g, "").trim() : "";
  const [catalog, canonicalIds] = await Promise.all([
    getPocketBaseAnimeCatalog(),
    getPocketBaseAnimeIds(),
  ]);
  const selectedGenres = (params.genres || "")
    .split(",")
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);
  const statusMap: Record<string, string> = {
    "finished-airing": "FINISHED",
    "currently-airing": "RELEASING",
    "not-yet-aired": "NOT_YET_RELEASED",
  };
  const status = statusMap[(params.status || "").toLowerCase()];
  const format = (params.type || "").toUpperCase();
  const season = (params.season || "").toUpperCase();

  const matches = catalog.filter((anime) => {
    const id = Number(anime.anilist_id);
    if (!id || !canonicalIds.has(id) || anime.isAdult || anime.is_adult) return false;

    const title = [
      anime.name_english,
      anime.name,
      anime.name_romaji,
      anime.original_title,
      anime.synonyms,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (cleanQuery && !title.includes(cleanQuery.toLowerCase())) return false;
    if (format && format !== "ALL" && String(anime.format || "").toUpperCase() !== format) {
      return false;
    }
    if (status && String(anime.anilist_status || "").toUpperCase() !== status) {
      return false;
    }

    const genres = Array.isArray(anime.anilist_genres)
      ? anime.anilist_genres.map(String).map((genre: string) => genre.toLowerCase())
      : String(anime.anilist_genres || "")
          .replaceAll("[", "")
          .replaceAll("]", "")
          .replaceAll('"', "")
          .split(/[,|]/)
          .map((genre: string) => genre.trim().toLowerCase());
    if (selectedGenres.some((genre) => !genres.includes(genre))) return false;

    if (season) {
      const month = Number(String(anime.release_date || "").slice(5, 7));
      const animeSeason =
        month >= 1 && month <= 3
          ? "WINTER"
          : month >= 4 && month <= 6
            ? "SPRING"
            : month >= 7 && month <= 9
              ? "SUMMER"
              : month >= 10 && month <= 12
                ? "FALL"
                : "";
      if (animeSeason !== season) return false;
    }

    return true;
  });

  const sorted = [...matches];
  switch ((params.sort || "").toLowerCase()) {
    case "score":
      sorted.sort((a, b) => Number(b.anilist_score || 0) - Number(a.anilist_score || 0));
      break;
    case "name-a-z":
      sorted.sort((a, b) =>
        getAnimeSeriesTitle(a).localeCompare(getAnimeSeriesTitle(b)),
      );
      break;
    case "recently-added":
      sorted.sort((a, b) =>
        String(b.created || "").localeCompare(String(a.created || "")),
      );
      break;
    case "recently-updated":
      sorted.sort((a, b) =>
        String(b.updated || "").localeCompare(String(a.updated || "")),
      );
      break;
    case "released-date":
      sorted.sort((a, b) =>
        String(b.release_date || "").localeCompare(String(a.release_date || "")),
      );
      break;
    case "most-watched":
      sorted.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
      break;
  }

  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;
  const totalPages = Math.min(Math.ceil(sorted.length / perPage), 20);
  const pageItems = sorted.slice((page - 1) * perPage, page * perPage);
  let apiImages = new Map<number, { poster: string | null; banner: string | null }>();
  try {
    apiImages = await fetchAnimeImagesForIds(pageItems.map((anime) => Number(anime.anilist_id)));
  } catch {
    // PocketBase images remain the fallback when AniList is unavailable.
  }

  return {
    animes: pageItems.map((anime) => ({
      id: String(anime.anilist_id),
      name: getAnimeSeriesTitle(anime) || "Untitled",
      jname: String(anime.original_title || anime.name_romaji || ""),
      poster:
        apiImages.get(Number(anime.anilist_id))?.poster ||
        getPocketBaseImageUrl(anime, anime.poster),
      episodes: {
        sub: Number(anime.episode_count) || 0,
        dub: Number(anime.episode_count) || 0,
      },
      type: String(anime.format || "TV") as any,
    })),
    totalPages: totalPages > 0 ? totalPages : 1,
    hasNextPage: page < totalPages,
    currentPage: page,
  };
};

export const useGetSearchAnimeResults = (params: SearchAnimeParams) => {
  return useQuery({
    queryFn: () => searchAnime(params),
    queryKey: [SEARCH_ANIME, { ...params }],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
