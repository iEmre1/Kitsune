"use client";

import { fetchSpotlight } from "@/lib/anilist-client";
import { MediaList } from "@/types/miruro-api";
import { useQuery } from "@tanstack/react-query";

export const GET_SPOTLIGHT_ANIME = "GET_SPOTLIGHT_ANIME";

const getSpotlightAnime = async (): Promise<MediaList[]> => {
  const data = await fetchSpotlight();
  const list = data.results || [];
  return list.filter((item) => !item.isAdult);
};

export const useGetSpotlightAnime = () => {
  return useQuery({
    queryFn: getSpotlightAnime,
    queryKey: [GET_SPOTLIGHT_ANIME],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
