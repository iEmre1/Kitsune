export type PBEpisodeRecord = {
  id: string;
  anime_id: string;
  anime_name?: string;
  season_number?: number | string;
  episode_number: number;
  translator_id?: number | string;
  translator_name?: string;
  translator_point?: number;
  fansub_name: string;
  player_url?: string;
  player_url1?: string;
  player_url2?: string;
  player_url3?: string;
  episode_id?: string;
  player_id?: string;
  title?: string;
  filler?: boolean;
  [key: string]: any;
};

export type PBGroupedEpisode = {
  id: string;
  number: number;
  title: string;
  filler: boolean;
  fansub_name: string;
  player_url?: string;
  episode_id?: string;
  player_id?: string;
  [key: string]: any;
};

export type PBFansubGroup = {
  fansub_name: string;
  episodes: {
    sub: PBGroupedEpisode[];
  };
};

export async function getPocketBaseEpisodeSeasons(
  anilistId: string | number,
): Promise<number[]> {
  const id = Number(anilistId);
  if (!Number.isSafeInteger(id) || id <= 0) return [];

  const { episodes: records } = await fetchAnimeEpisodesFromPB(id);
  const seasons = Array.from(
    new Set(
      records
        .map((record) => Number(record.season_number))
        .filter((season) => Number.isSafeInteger(season) && season > 0),
    ),
  ).sort((left, right) => left - right);

  return seasons.length ? seasons : records.length ? [1] : [];
}

export async function fetchAnimeEpisodesFromPB(
  anilistId: string | number,
  seasonNumber?: number,
): Promise<{ animeRecords: Record<string, any>[]; episodes: PBEpisodeRecord[] }> {
  const id = Number(anilistId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { animeRecords: [], episodes: [] };
  }

  const params = new URLSearchParams({ anilist_id: String(id) });
  if (Number.isSafeInteger(seasonNumber) && Number(seasonNumber) > 0) {
    params.set("season_number", String(seasonNumber));
  }

  const response = await fetch(`/api/pocketbase/episodes?${params.toString()}`);
  if (!response.ok) throw new Error("PocketBase bölüm listesi alınamadı");
  return (await response.json()) as {
    animeRecords: Record<string, any>[];
    episodes: PBEpisodeRecord[];
  };
}

export function groupPBRecords(
  records: PBEpisodeRecord[],
): Record<string, PBFansubGroup> {
  const fansubsMap: Record<string, PBFansubGroup> = {};

  for (const rec of records) {
    const fansubName =
      rec.fansub_name?.trim() || rec.translator_name?.trim() || "Bilinmeyen";

    if (!fansubsMap[fansubName]) {
      fansubsMap[fansubName] = {
        fansub_name: fansubName,
        episodes: {
          sub: [],
        },
      };
    }

    fansubsMap[fansubName].episodes.sub.push({
      ...rec,
      id: rec.episode_id || rec.player_id || rec.id || `${rec.episode_number}`,
      number: rec.episode_number,
      title: rec.title || `Episode ${rec.episode_number}`,
      filler: rec.filler || false,
      fansub_name: fansubName,
      player_url: rec.player_url,
      episode_id: rec.episode_id,
      player_id: rec.player_id,
    });
  }

  return fansubsMap;
}
