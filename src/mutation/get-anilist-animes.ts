"use client";

import { anilistClientQuery } from "@/lib/anilist-client";
import { AnilistAnimes } from "@/types/anilist-animes";
import { useMutation } from "@tanstack/react-query";

const ANILIST_LIST_QUERY = `
  query ($username: String) {
     MediaListCollection(type: ANIME, userName: $username) {
      lists {
        name
        status
        entries {
          media {
            id
            bannerImage
            coverImage {
              extraLarge
              large
            }
            idMal
            title {
              english
              romaji
              native
            }
          }
        }
      }
    }
  }
`;

const getAnilistAnimes = async (username: string) => {
  const data = await anilistClientQuery<AnilistAnimes["data"]>(
    ANILIST_LIST_QUERY,
    { username },
    5 * 60 * 1000,
  );
  return data;
};

export const useGetAnilistAnimes = () => {
  return useMutation({
    mutationFn: getAnilistAnimes,
    onError: (error) => {
      console.error("Error fetching Anilist animes:", error);
    },
  });
};
