import type { WatchHistory } from "@/hooks/use-get-bookmark";

export const LOCAL_WATCH_HISTORY_KEY = "kitsune_watch_history";
export const LOCAL_WATCH_HISTORY_EVENT = "kitsune-watch-history-updated";

const LEGACY_WATCHED_KEY = "watched";
const MAX_LOCAL_RECORDS = 300;

export type LocalWatchRecord = {
  animeId: string;
  animeTitle: string;
  animePoster: string;
  episodeId?: string;
  episodeNumber: number;
  current: number;
  timestamp: number;
  updatedAt: string;
};

export type LocalWatchInput = Omit<LocalWatchRecord, "updatedAt"> & {
  updatedAt?: string;
};

export type LocalContinueWatchingItem = {
  animeId: string;
  animeTitle: string;
  animePoster: string;
  episode: LocalWatchRecord;
};

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

function safeParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeRecord(value: unknown): LocalWatchRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LocalWatchRecord>;
  if (!record.animeId || typeof record.animeId !== "string") return null;
  const episodeNumber = Number(record.episodeNumber);
  if (!Number.isFinite(episodeNumber) || episodeNumber <= 0) return null;

  return {
    animeId: record.animeId,
    animeTitle:
      typeof record.animeTitle === "string" && record.animeTitle.trim()
        ? record.animeTitle
        : "Anime",
    animePoster: typeof record.animePoster === "string" ? record.animePoster : "",
    episodeId: typeof record.episodeId === "string" ? record.episodeId : undefined,
    episodeNumber,
    current: Number.isFinite(Number(record.current)) ? Number(record.current) : 0,
    timestamp: Number.isFinite(Number(record.timestamp)) ? Number(record.timestamp) : 0,
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

export function readLocalWatchHistory(): LocalWatchRecord[] {
  if (!isBrowser()) return [];
  const parsed = safeParse(localStorage.getItem(LOCAL_WATCH_HISTORY_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(normalizeRecord)
    .filter((record): record is LocalWatchRecord => record !== null);
}

function writeLocalWatchHistory(records: LocalWatchRecord[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LOCAL_WATCH_HISTORY_KEY, JSON.stringify(records));
  } catch {
    // Storage may be full or unavailable; watch tracking should never break playback.
  }
}

function notifyLocalWatchHistoryChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(LOCAL_WATCH_HISTORY_EVENT));
}

export function saveLocalWatchProgress(input: LocalWatchInput): LocalWatchRecord | null {
  if (!isBrowser() || !input.animeId) return null;

  const normalized = normalizeRecord({
    ...input,
    updatedAt: input.updatedAt || new Date().toISOString(),
  });
  if (!normalized) return null;

  const records = readLocalWatchHistory().filter((record) => {
    if (record.animeId !== normalized.animeId) return true;
    if (normalized.episodeId && record.episodeId) {
      return record.episodeId !== normalized.episodeId;
    }
    return Number(record.episodeNumber) !== Number(normalized.episodeNumber);
  });

  records.unshift(normalized);
  writeLocalWatchHistory(records.slice(0, MAX_LOCAL_RECORDS));
  notifyLocalWatchHistoryChanged();
  return normalized;
}

export function getLocalWatchRecord(
  animeId: string,
  episodeId?: string,
  episodeNumber?: number,
): LocalWatchRecord | null {
  return (
    readLocalWatchHistory().find(
      (record) =>
        record.animeId === animeId &&
        ((!!episodeId && record.episodeId === episodeId) ||
          (episodeNumber !== undefined &&
            Number(record.episodeNumber) === Number(episodeNumber))),
    ) || null
  );
}

export function getLocalContinueWatching(): LocalContinueWatchingItem[] {
  const latestByAnime = new Map<string, LocalWatchRecord>();

  for (const record of readLocalWatchHistory()) {
    const existing = latestByAnime.get(record.animeId);
    if (
      !existing ||
      new Date(record.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    ) {
      latestByAnime.set(record.animeId, record);
    }
  }

  return Array.from(latestByAnime.values())
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .map((record) => ({
      animeId: record.animeId,
      animeTitle: record.animeTitle,
      animePoster: record.animePoster,
      episode: record,
    }));
}

export function getLocalLastWatched(animeId: string): LocalWatchRecord | null {
  const records = readLocalWatchHistory()
    .filter((record) => record.animeId === animeId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  return records[0] || null;
}

export function isLocalAnimeWatched(animeId: string): boolean {
  return readLocalWatchHistory().some((record) => record.animeId === animeId);
}

export function isLocalEpisodeWatched(
  animeId: string,
  episodeId?: string,
  episodeNumber?: number,
): boolean {
  if (!episodeId && episodeNumber === undefined) return false;
  return readLocalWatchHistory().some(
    (record) =>
      record.animeId === animeId &&
      ((!!episodeId && record.episodeId === episodeId) ||
        (episodeNumber !== undefined &&
          Number(record.episodeNumber) === Number(episodeNumber))),
  );
}

export function localRecordToWatchHistory(record: LocalWatchRecord): WatchHistory {
  return {
    id: `local-${record.animeId}-${record.episodeNumber}-${record.updatedAt}`,
    current: record.current,
    timestamp: record.timestamp,
    episodeId: record.episodeId,
    episodeNumber: record.episodeNumber,
    created: record.updatedAt,
  };
}

function parseEpisodeNumberFromId(episodeId: string): number | null {
  const match = episodeId.match(/(\d+)\D*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Converts the old guest shape (`watched`: [{ anime, episodes }]) into the new
 * record format so existing guests do not lose their progress.
 */
export function migrateLegacyLocalWatchHistory(): void {
  if (!isBrowser()) return;
  if (localStorage.getItem(LOCAL_WATCH_HISTORY_KEY)) return;

  const legacy = safeParse(localStorage.getItem(LEGACY_WATCHED_KEY));
  if (!Array.isArray(legacy)) return;

  const records: LocalWatchRecord[] = [];

  for (const item of legacy) {
    if (!item || typeof item !== "object") continue;
    const entry = item as {
      anime?: { id?: string; title?: string; poster?: string };
      episodes?: unknown;
    };
    const anime = entry.anime;
    if (!anime?.id || !Array.isArray(entry.episodes)) continue;

    const episodeIds = entry.episodes.filter(
      (episodeId): episodeId is string => typeof episodeId === "string",
    );
    if (episodeIds.length === 0) continue;

    episodeIds.forEach((episodeId, index) => {
      const episodeNumber =
        parseEpisodeNumberFromId(episodeId) || episodeIds.length - index;
      records.push({
        animeId: String(anime.id),
        animeTitle: anime.title || "Anime",
        animePoster: anime.poster || "",
        episodeId,
        episodeNumber,
        current: 0,
        timestamp: 0,
        updatedAt: new Date(Date.now() - index).toISOString(),
      });
    });
  }

  if (records.length > 0) {
    writeLocalWatchHistory(records.slice(0, MAX_LOCAL_RECORDS));
    notifyLocalWatchHistoryChanged();
  }
}
