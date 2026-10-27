const __name = (fn, _) => fn;

import { anilistGraphQL } from "./anilist-web.js";

var resolved = new Map();
var inflight = new Map();
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var ARM = "https://arm.haglund.dev/api/v2/ids";

const AL_STATUS_MAP = {
  RELEASING: "RELEASING",
  FINISHED: "FINISHED",
  NOT_YET_RELEASED: "NOT_YET_RELEASED",
  CANCELLED: "FINISHED",
  HIATUS: "HIATUS",
};

async function fetchFromAniList(id) {
  const fullQuery = `query($id:Int){Media(id:$id,type:ANIME){id idMal title{english romaji native} status format episodes seasonYear startDate{year} genres synonyms nextAiringEpisode{episode airingAt timeUntilAiring}}}`;
  const json = await anilistGraphQL(fullQuery, { id });
  return json?.data?.Media ?? null;
}

async function getMedia(anilistId) {
  const id = Number(anilistId);
  if (resolved.has(id)) return resolved.get(id);
  if (inflight.has(id)) return inflight.get(id);
  const promise = (async () => {
    const arm = await fetch(`${ARM}?source=anilist&id=${id}`, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    }).then((r) => {
      if (!r.ok) return null;
      return r.json();
    }).catch(() => null);

    const al = await fetchFromAniList(id);
    const idMal = al?.idMal ?? arm?.myanimelist ?? null;
    if (!al && !idMal) {
      throw new Error(`No data found for AniList ID ${id}`);
    }
    const media = {
      id,
      idMal,
      title: {
        english: al?.title?.english ?? null,
        romaji: al?.title?.romaji ?? null,
        native: al?.title?.native ?? null,
      },
      status: AL_STATUS_MAP[al?.status] ?? "RELEASING",
      format: al?.format ?? null,
      episodes: al?.episodes ?? null,
      seasonYear: al?.seasonYear ?? null,
      startDate: al?.startDate ?? null,
      genres: Array.isArray(al?.genres) ? al.genres : [],
      nextAiringEpisode: al?.nextAiringEpisode ?? null,
      synonyms: Array.isArray(al?.synonyms) ? al.synonyms : [],
    };
    if (resolved.size >= 150) {
      resolved.delete(resolved.keys().next().value);
    }
    resolved.set(id, media);
    inflight.delete(id);
    return media;
  })().catch((e) => {
    inflight.delete(id);
    throw e;
  });
  inflight.set(id, promise);
  return promise;
}
__name(getMedia, "getMedia");

function forgetMedia(anilistId) {
  resolved.delete(Number(anilistId));
}

export { getMedia, forgetMedia };
