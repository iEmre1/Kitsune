"use client";

import { GET_ALL_EPISODES } from "@/constants/query-keys";
import { Episode, IEpisodes } from "@/types/episodes";
import { EpisodeResponse, NextAiringEpisode } from "@/types/miruro-api";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAnimeEpisodesFromPB,
  groupPBRecords,
} from "@/lib/episodes-cache";

const KNOWN_PROVIDERS = [
  "anizone",
  "reanime",
  "anikoto",
  "aniwaves",
  "animegg",
  "animenosub",
  "kaa",
  "animedunya",
  "animeonsen",
  "senshi",
  "anipm",
  "mkissa",
];

export interface IEpisodesData extends IEpisodes {
  rawResponse?: EpisodeResponse;
  availableProviders?: string[];
  nextAiringEpisode?: NextAiringEpisode | null;
  seasonNumber?: number | null;
}

const getAllEpisodes = async (
  animeId: string,
  seriesAnimeId: string,
  selectedSeasonNumber?: number,
): Promise<IEpisodesData> => {
  const seasonNumber = selectedSeasonNumber || 1;
  let data = await fetchAnimeEpisodesFromPB(animeId, seasonNumber);
  if (!data.episodes.length && seriesAnimeId !== animeId) {
    data = await fetchAnimeEpisodesFromPB(seriesAnimeId, seasonNumber);
  }
  const records = data.episodes;
  if (!records.length) {
    return {
      totalEpisodes: 0,
      episodes: [],
      availableProviders: [],
      nextAiringEpisode: null,
      seasonNumber,
    };
  }

  const providersMap = groupPBRecords(records);
  const providerNames = Object.keys(providersMap).sort((left, right) => {
    const leftIndex = KNOWN_PROVIDERS.indexOf(left);
    const rightIndex = KNOWN_PROVIDERS.indexOf(right);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
  const subEpisodesByNumber = new Map<number, any>();

  for (const providerName of providerNames) {
    const episodes = providersMap[providerName]?.episodes?.sub || [];
    for (const episode of episodes) {
      const number = Number(episode.number);
      if (Number.isFinite(number) && number > 0 && !subEpisodesByNumber.has(number)) {
        subEpisodesByNumber.set(number, episode);
      }
    }
  }

  const episodes: Episode[] = Array.from(subEpisodesByNumber.entries())
    .sort(([left], [right]) => left - right)
    .map(([number, episode]) => ({
      title: episode.title || `Episode ${number}`,
      episodeId: episode.id || episode.episode_id || String(number),
      number,
      isFiller: Boolean(episode.filler),
      hasSub: true,
      hasDub: false,
    }));

  const rawResponse: EpisodeResponse = {
    providers: providersMap,
    mappings: { anilistId: Number(animeId) },
  } as EpisodeResponse;

  return {
    totalEpisodes: episodes.length,
    episodes,
    rawResponse,
    availableProviders: providerNames,
    nextAiringEpisode: null,
    seasonNumber,
  };
};

export const useGetAllEpisodes = (
  animeId: string,
  seriesAnimeId = animeId,
  seasonNumber?: number,
) => {
  return useQuery({
    queryFn: () => getAllEpisodes(animeId, seriesAnimeId, seasonNumber),
    queryKey: [GET_ALL_EPISODES, "pocketbase-only", animeId, seriesAnimeId, seasonNumber],
    enabled: !!animeId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
