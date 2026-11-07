import { useState, useEffect } from "react";
import { WatchHistory } from "./use-get-bookmark";
import { useAuthStore } from "@/store/auth-store";
import { pb } from "@/lib/pocketbase";
import {
  isLocalAnimeWatched,
  isLocalEpisodeWatched,
  LOCAL_WATCH_HISTORY_EVENT,
} from "@/lib/local-watch-history";

export const useHasAnimeWatched = (
  animeId: string,
  episodeId?: string,
  watchedEpisodes?: WatchHistory[],
  episodeNumber?: number,
) => {
  const { auth } = useAuthStore();
  const isAuthenticated = Boolean(auth?.id || pb.authStore.record?.id);
  const [localState, setLocalState] = useState({
    hasWatchedAnime: false,
    hasWatchedEpisode: false,
  });

  useEffect(() => {
    if (isAuthenticated || typeof window === "undefined") return;

    const syncFromLocalStorage = () => {
      setLocalState({
        hasWatchedAnime: isLocalAnimeWatched(animeId),
        hasWatchedEpisode: isLocalEpisodeWatched(
          animeId,
          episodeId,
          episodeNumber,
        ),
      });
    };

    syncFromLocalStorage();
    window.addEventListener("storage", syncFromLocalStorage);
    window.addEventListener(
      LOCAL_WATCH_HISTORY_EVENT,
      syncFromLocalStorage,
    );

    return () => {
      window.removeEventListener("storage", syncFromLocalStorage);
      window.removeEventListener(
        LOCAL_WATCH_HISTORY_EVENT,
        syncFromLocalStorage,
      );
    };
  }, [animeId, episodeId, episodeNumber, isAuthenticated]);

  // Signed-in users always read from the database-backed bookmark history.
  if (isAuthenticated) {
    const hasWatchedAnime = Boolean(watchedEpisodes?.length);
    const hasWatchedEpisode =
      hasWatchedAnime &&
      (episodeId !== undefined || episodeNumber !== undefined) &&
      Boolean(
        watchedEpisodes?.some(
          (episode) =>
            (episodeId !== undefined && episode.episodeId === episodeId) ||
            (episodeNumber !== undefined &&
              Number(episode.episodeNumber) === Number(episodeNumber)),
        ),
      );

    return { hasWatchedAnime, hasWatchedEpisode };
  }

  return localState;
};
