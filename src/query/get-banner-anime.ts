"use client";

import { GET_ANIME_BANNER } from "@/constants/query-keys";
import { anilistClientQuery } from "@/lib/anilist-client";
import { useQuery } from "@tanstack/react-query";

interface IAnimeBanner {
  Media: {
    id: number;
    bannerImage: string;
  };
}

const BANNER_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      bannerImage
    }
  }
`;

const getAnimeBanner = async (anilistID: number) => {
  const data = await anilistClientQuery<IAnimeBanner>(BANNER_QUERY, {
    id: anilistID,
  });
  return data;
};

export const useGetAnimeBanner = (anilistID: number) => {
  return useQuery({
    queryFn: () => getAnimeBanner(anilistID),
    queryKey: [GET_ANIME_BANNER, anilistID],
    enabled: !!anilistID,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
