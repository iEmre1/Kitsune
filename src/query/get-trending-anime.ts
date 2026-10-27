"use client";

import { fetchMediaPage } from "@/lib/anilist-client";
import { MediaList, PaginatedResponse } from "@/types/miruro-api";
import { useQuery } from "@tanstack/react-query";

export const GET_TRENDING_ANIME = "GET_TRENDING_ANIME";

const getTrendingAnime = async (
  page = 1,
  perPage = 20,
): Promise<PaginatedResponse<MediaList>> => {
  const data = await fetchMediaPage({
    page,
    perPage,
    sort: ["TRENDING_DESC", "POPULARITY_DESC"],
  });
  return {
    ...data,
    results: (data.results || []).filter((item) => !item.isAdult),
  };
};

export const useGetTrendingAnime = (page = 1, perPage = 20) => {
  return useQuery({
    queryFn: () => getTrendingAnime(page, perPage),
    queryKey: [GET_TRENDING_ANIME, page, perPage],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
