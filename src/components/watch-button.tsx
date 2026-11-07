"use client";

import React from "react";
import { CirclePlay } from "lucide-react";
import { ROUTES } from "@/constants/routes";

import { usePathname } from "next/navigation";
import { ButtonLink } from "./common/button-link";
import { useHasAnimeWatched } from "@/hooks/use-is-anime-watched";
import { useGetLastEpisodeWatched } from "@/hooks/use-get-last-episode-watched";
import useBookMarks from "@/hooks/use-get-bookmark";
import { useAuthStore } from "@/store/auth-store";

const WatchButton = () => {
  const pathName = usePathname();
  const animeId = pathName.split("/")[2];
  const { auth } = useAuthStore();

  const { bookmarks } = useBookMarks({
    animeID: animeId,
    page: 1,
    per_page: 1,
    populate: !!auth,
  });
  const watchedEpisodes = bookmarks?.[0]?.expand?.watchHistory ?? null;

  const { hasWatchedAnime } = useHasAnimeWatched(
    animeId,
    undefined,
    watchedEpisodes ?? undefined,
  );
  const latestEpisodeWatched = useGetLastEpisodeWatched(
    animeId,
    watchedEpisodes,
  );

  return (
    <ButtonLink
      href={
        !hasWatchedAnime || !latestEpisodeWatched
          ? `${ROUTES.WATCH}?anime=${animeId}`
          : `${ROUTES.WATCH}?anime=${animeId}&ep=${latestEpisodeWatched}`
      }
      className="max-w-fit text-base"
      LeftIcon={CirclePlay}
    >
      {hasWatchedAnime ? "İzlemeye Devam Et" : "İzlemeye Başla"}
    </ButtonLink>
  );
};

export default WatchButton;
