"use client";

import { fetchHomepageData } from "@/lib/anilist-client";
import { useQuery } from "@tanstack/react-query";

export const GET_HOMEPAGE_ANIME = "GET_HOMEPAGE_ANIME";

export const useGetHomepageAnime = (
  trendingPage = 1,
  upcomingPage = 1,
  perPage = 14,
) =>
  useQuery({
    queryFn: () => fetchHomepageData(trendingPage, upcomingPage, perPage),
    queryKey: [GET_HOMEPAGE_ANIME, trendingPage, upcomingPage, perPage],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });