"use client";

import { GET_ANIME_SCHEDULE } from "@/constants/query-keys";
import { fetchSchedule } from "@/lib/anilist-client";
import { IAnimeSchedule } from "@/types/anime-schedule";
import { useQuery } from "@tanstack/react-query";

const getAnimeSchedule = async (date?: string): Promise<IAnimeSchedule> => {
  const data = await fetchSchedule(date);
  const items = data.results || [];

  const scheduledAnimes = items.map((item) => {
    const hours = Math.floor((item.timeUntilAiring || 0) / 3600);
    const minutes = Math.floor(((item.timeUntilAiring || 0) % 3600) / 60);
    const timeString =
      item.timeUntilAiring > 0
        ? `${hours} saat ${minutes} dk içinde`
        : "Yakında yayınlanacak";

    return {
      id: String(item.id),
      name: item.title?.english || item.title?.romaji || item.title?.native || "Untitled",
      jname: item.title?.native || item.title?.romaji || "",
      poster: item.coverImage?.extraLarge || item.coverImage?.large || "",
      time: timeString,
      airingTimestamp: item.airingAt ? item.airingAt * 1000 : Date.now(),
      secondsUntilAiring: item.timeUntilAiring || 0,
      episode: item.next_episode || 1,
    };
  });

  return { scheduledAnimes };
};

export const useGetAnimeSchedule = (date?: string) => {
  return useQuery({
    queryFn: () => getAnimeSchedule(date),
    queryKey: [GET_ANIME_SCHEDULE, date],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
