"use client";

import { useEffect, useRef } from "react";
import { pb } from "@/lib/pocketbase";
import { useAuthStore } from "@/store/auth-store";
import useBookMarks from "@/hooks/use-get-bookmark";
import { saveLocalWatchProgress } from "@/lib/local-watch-history";

const CHECK_INTERVAL_MS = 5000;
const MIN_VISIBLE_MS = 10000;

type Props = {
  active: boolean;
  animeId: string;
  animeTitle: string;
  animePoster: string;
  episodeId?: string;
  episodeNumber: number;
};

/**
 * Embedded (iframe) players are cross-origin, so their playback time cannot be
 * read. To keep "Continue Watching" and the activity graph useful for those
 * sources, mark the episode as watched after the viewer has kept the page
 * visible for a short while.
 */
export const useIframeWatchTracking = ({
  active,
  animeId,
  animeTitle,
  animePoster,
  episodeId,
  episodeNumber,
}: Props) => {
  const { auth } = useAuthStore();
  const { createOrUpdateBookMark, markEpisodeWatched } = useBookMarks({
    populate: false,
  });
  const markedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active || !animeId || !episodeNumber) return;

    const key = `${animeId}:${episodeNumber}:${episodeId || ""}`;
    if (markedKeysRef.current.has(key)) return;

    let visibleMs = 0;
    let cancelled = false;

    const persist = async () => {
      if (cancelled) return;

      const isAuthenticated = Boolean(
        auth?.id || pb.authStore.record?.id,
      );

      if (!isAuthenticated) {
        saveLocalWatchProgress({
          animeId,
          animeTitle,
          animePoster,
          episodeId,
          episodeNumber,
          current: 0,
          timestamp: 0,
        });
        markedKeysRef.current.add(key);
        return;
      }

      const bookmarkId = await createOrUpdateBookMark(
        animeId,
        animeTitle || "Anime",
        animePoster,
        "watching",
        false,
      );
      if (!bookmarkId) return;

      const recordId = await markEpisodeWatched(bookmarkId, {
        episodeId,
        episodeNumber,
      });
      if (recordId) {
        markedKeysRef.current.add(key);
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleMs += CHECK_INTERVAL_MS;
      if (visibleMs >= MIN_VISIBLE_MS) {
        window.clearInterval(interval);
        void persist();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    active,
    animeId,
    animeTitle,
    animePoster,
    episodeId,
    episodeNumber,
    auth?.id,
    createOrUpdateBookMark,
    markEpisodeWatched,
  ]);
};
