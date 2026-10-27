"use client";

import { getPocketBaseEpisodeSeasons } from "@/lib/episodes-cache";
import { useQuery } from "@tanstack/react-query";

const getAvailableAnimeSeasons = async (anilistId: string) => {
  const seasonNumbers = await getPocketBaseEpisodeSeasons(anilistId);
  return seasonNumbers.map((seasonNumber) => ({
    value: String(seasonNumber),
    label: `Sezon ${seasonNumber}`,
    seasonNumber,
  }));
};

export const useGetAnimeSeasons = (anilistId: string) =>
  useQuery({
    queryKey: ["GET_ANIME_SEASONS", "pocketbase-season-numbers-v2", anilistId],
    queryFn: () => getAvailableAnimeSeasons(anilistId),
    enabled: Boolean(anilistId),
    staleTime: 5 * 60 * 1000,
  });