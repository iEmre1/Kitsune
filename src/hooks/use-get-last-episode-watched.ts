import { useState, useEffect } from "react";
import { WatchHistory } from "./use-get-bookmark";
import { useAuthStore } from "@/store/auth-store";
import { pb } from "@/lib/pocketbase";
import {
  getLocalLastWatched,
  LOCAL_WATCH_HISTORY_EVENT,
} from "@/lib/local-watch-history";

export const useGetLastEpisodeWatched = (
  animeId: string,
  watchedEpisodes?: WatchHistory[] | null,
) => {
  const { auth } = useAuthStore();
  const isAuthenticated = Boolean(auth?.id || pb.authStore.record?.id);
  const [lastEpisodeWatched, setLastEpisodeWatched] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (isAuthenticated) {
      const latest = watchedEpisodes
        ? [...watchedEpisodes].sort(
            (a, b) => b.episodeNumber - a.episodeNumber,
          )[0]
        : null;
      setLastEpisodeWatched(latest ? latest.episodeNumber : null);
      return;
    }

    if (typeof window === "undefined") return;

    const syncFromLocalStorage = () => {
      const record = getLocalLastWatched(animeId);
      setLastEpisodeWatched(record ? record.episodeNumber : null);
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
  }, [animeId, isAuthenticated, watchedEpisodes]);

  return lastEpisodeWatched;
};
