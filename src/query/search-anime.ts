"use client";

import {
  getPocketBaseImageUrl,
  getAnimeSeriesTitle,
  getPocketBaseAnimeCatalog,
  getPocketBaseAnimeIds,
} from "@/lib/pocketbase-anime";
import { fetchAnimeImagesForIds } from "@/lib/anilist-client";
import { ISuggestionAnime } from "@/types/anime";
import { useQuery } from "@tanstack/react-query";

const searchAnime = async (q: string): Promise<ISuggestionAnime[]> => {
  if (!q) return [];
  const [catalog, canonicalIds] = await Promise.all([
    getPocketBaseAnimeCatalog(),
    getPocketBaseAnimeIds(),
  ]);
  const query = q.trim().toLowerCase();
  const seenIds = new Set<number>();
  const matches = catalog.filter((anime) => {
      const id = Number(anime.anilist_id);
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
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
      return id && canonicalIds.has(id) && title.includes(query);
    })
    .slice(0, 8);
  let apiImages = new Map<number, { poster: string | null; banner: string | null }>();
  try {
    apiImages = await fetchAnimeImagesForIds(matches.map((anime) => Number(anime.anilist_id)));
  } catch {
    // PocketBase images remain the fallback when AniList is unavailable.
  }

  return matches.map((anime) => ({
    id: String(anime.anilist_id),
    name: getAnimeSeriesTitle(anime) || "Untitled",
    jname: String(anime.name_romaji || anime.original_title || ""),
    poster:
      apiImages.get(Number(anime.anilist_id))?.poster ||
      getPocketBaseImageUrl(anime, anime.poster),
    episodes: {
      sub: Number(anime.episode_count) || 0,
      dub: Number(anime.episode_count) || 0,
    },
    type: String(anime.format || "TV") as any,
    moreInfo: [
      anime.release_date ? String(anime.release_date).slice(0, 4) : "",
      anime.format || "",
      anime.anilist_status || "",
    ].filter(Boolean),
  }));
};

export const useSearchAnime = (query: string) => {
  return useQuery({
    queryFn: () => searchAnime(query),
    queryKey: ["search-suggestions", query],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!query,
  });
};
