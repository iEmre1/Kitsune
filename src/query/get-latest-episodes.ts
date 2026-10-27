"use client";

import { fetchAnimeImagesForIds, fetchMediaPage } from "@/lib/anilist-client";
import { pb } from "@/lib/pocketbase";
import {
  getAnimeSeriesTitle,
  getPocketBaseImageUrl,
  getPocketBaseAnimeCatalog,
  getPocketBaseAnimeIds,
  PBAnimeRecord,
} from "@/lib/pocketbase-anime";
import { MediaList, PaginatedResponse } from "@/types/miruro-api";
import { useQuery } from "@tanstack/react-query";

export const GET_LATEST_EPISODES = "GET_LATEST_EPISODES";

const getLatestEpisodes = async (
  page = 1,
  perPage = 20,
): Promise<PaginatedResponse<MediaList & { latestAddedEpisode: number }>> => {
  const [animeRecords, episodeRecords, canonicalIds] = await Promise.all([
    getPocketBaseAnimeCatalog(),
    pb.collection("episodes").getList(1, 200, {
      sort: "-created",
      requestKey: null,
    }),
    getPocketBaseAnimeIds(),
  ]);
  const animeByAnimecixId = new Map<string, PBAnimeRecord>();
  for (const anime of animeRecords) {
    if (anime.animecix_id === undefined || anime.animecix_id === null) continue;
    const key = String(anime.animecix_id);
    const current = animeByAnimecixId.get(key);
    if (
      !current ||
      (!canonicalIds.has(Number(current.anilist_id)) &&
        canonicalIds.has(Number(anime.anilist_id)))
    ) {
      animeByAnimecixId.set(key, anime);
    }
  }

  const firstEpisodeRecords = new Map<
    string,
    { anime: PBAnimeRecord; episodeNumber: number; created: string }
  >();
  for (const episode of episodeRecords.items) {
    const anime = animeByAnimecixId.get(String(episode.anime_id));
    const episodeNumber = Number(episode.episode_number);
    if (!anime || !Number(anime.anilist_id) || !episodeNumber) continue;
    if (anime.isAdult || anime.is_adult) continue;
    const key = `${episode.anime_id}|${episodeNumber}`;
    if (!firstEpisodeRecords.has(key)) {
      firstEpisodeRecords.set(key, {
        anime,
        episodeNumber,
        created: String(episode.created || ""),
      });
    }
  }

  const distinctEpisodes = Array.from(firstEpisodeRecords.values()).sort(
    (left, right) => right.created.localeCompare(left.created),
  );
  const start = (page - 1) * perPage;
  const pageEpisodes = distinctEpisodes.slice(start, start + perPage);
  let apiImages = new Map<number, { poster: string | null; banner: string | null }>();
  try {
    apiImages = await fetchAnimeImagesForIds(
      pageEpisodes.map(({ anime }) => Number(anime.anilist_id)),
    );
  } catch {
    // Keep PocketBase images as the fallback when AniList is unavailable.
  }

  const results = pageEpisodes
    .map(({ anime, episodeNumber }) => {
      const id = Number(anime.anilist_id);
      const title = getAnimeSeriesTitle(anime) || anime.name || "Başlıksız";
      const poster = getPocketBaseImageUrl(
        anime,
        apiImages.get(id)?.poster || anime.poster || anime.cover || anime.image,
      );
      const score = Number(anime.anilist_score) || null;
      const year = Number(String(anime.release_date || "").slice(0, 4)) || null;

      return {
        id,
        title: {
          english: title,
          romaji: String(anime.name_romaji || title),
          native: String(anime.original_title || ""),
        },
        coverImage: { large: poster, extraLarge: poster },
        bannerImage:
          apiImages.get(id)?.banner ||
          (anime.banner && anime.banner !== anime.poster
            ? getPocketBaseImageUrl(anime, anime.banner)
            : null),
        format: (anime.format || "TV") as MediaList["format"],
        season: null,
        seasonYear: year,
        episodes: Number(anime.episode_count) || episodeNumber,
        duration: Number(anime.runtime) || null,
        status: (anime.anilist_status || "FINISHED") as MediaList["status"],
        averageScore: score,
        meanScore: score,
        popularity: Number(anime.popularity) || 0,
        favourites: 0,
        genres: [],
        source: null,
        countryOfOrigin: "JP",
        isAdult: false,
        studios: { nodes: [] },
        nextAiringEpisode: null,
        startDate: { year, month: null, day: null },
        endDate: { year: null, month: null, day: null },
        latestAddedEpisode: episodeNumber,
      };
    });

  if (!results.length) {
    const fallback = await fetchMediaPage({
      page,
      perPage,
      sort: ["UPDATED_AT_DESC", "POPULARITY_DESC"],
    });

    return {
      page: fallback.page,
      perPage: fallback.perPage,
      total: fallback.total,
      hasNextPage: fallback.hasNextPage,
      results: (fallback.results || []).slice(0, perPage).map((item) => ({
        ...item,
        latestAddedEpisode: Number(item.episodes) || 1,
        coverImage: {
          large: item.coverImage?.large || "/icon.png",
          extraLarge: item.coverImage?.extraLarge || item.coverImage?.large || "/icon.png",
        },
      })),
    };
  }

  return {
    page,
    perPage,
    total: distinctEpisodes.length,
    hasNextPage: start + perPage < distinctEpisodes.length,
    results,
  };
};

export const useGetLatestEpisodes = (page = 1, perPage = 20) =>
  useQuery({
    queryFn: () => getLatestEpisodes(page, perPage),
    queryKey: [GET_LATEST_EPISODES, page, perPage],
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });