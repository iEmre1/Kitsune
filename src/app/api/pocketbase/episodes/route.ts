import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;
const ANIME_FIELDS =
  "id,anilist_id,animecix_id,name,name_english,name_romaji,season_count,season_number,release_date";
const EPISODE_FIELDS =
  "id,anime_id,anime_name,season_number,episode_number,translator_id,translator_name,translator_point,fansub_name,player_url,player_url1,player_url2,player_url3,created,updated";

async function getRecords(collection: string, filter: string, fields: string) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://localhost:8090"
  ).replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/collections/${collection}/records`);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", String(PAGE_SIZE));
  url.searchParams.set("skipTotal", "1");
  url.searchParams.set("filter", filter);
  url.searchParams.set("fields", fields);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
}

async function getAnimeRecords(anilistId: number) {
  const id = String(anilistId);
  const quoted = await getRecords("animes", `anilist_id = "${id}"`, ANIME_FIELDS);
  if (quoted?.length) return quoted;

  const numeric = await getRecords("animes", `anilist_id = ${id}`, ANIME_FIELDS);
  return numeric || [];
}

async function getEpisodes(animecixId: string, seasonNumber?: number) {
  const escapedId = animecixId.replace(/"/g, '\\"');
  const seasonFilter = seasonNumber ? ` && season_number = ${seasonNumber}` : "";
  const quoted = await getRecords(
    "episodes",
    `anime_id = "${escapedId}"${seasonFilter}`,
    EPISODE_FIELDS,
  );
  if (quoted?.length) return quoted;

  const numericId = Number(animecixId);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return quoted || [];
  const numeric = await getRecords(
    "episodes",
    `anime_id = ${numericId}${seasonFilter}`,
    EPISODE_FIELDS,
  );
  return numeric || quoted || [];
}

export async function GET(request: NextRequest) {
  const anilistId = Number(request.nextUrl.searchParams.get("anilist_id"));
  const requestedSeason = request.nextUrl.searchParams.get("season_number");
  const seasonNumber = requestedSeason === null ? undefined : Number(requestedSeason);

  if (
    !Number.isSafeInteger(anilistId) ||
    anilistId <= 0 ||
    (seasonNumber !== undefined &&
      (!Number.isSafeInteger(seasonNumber) || seasonNumber <= 0))
  ) {
    return Response.json({ error: "Geçersiz anime veya sezon numarası" }, { status: 400 });
  }

  try {
    const animeRecords = await getAnimeRecords(anilistId);
    const animecixIds: string[] = Array.from(
      new Set<string>(
        animeRecords
          .map((anime: any) => String(anime.animecix_id || "").trim())
          .filter(Boolean),
      ),
    );
    const episodes = (
      await Promise.all(animecixIds.map((id) => getEpisodes(id, seasonNumber)))
    ).flat();

    return Response.json({ animeRecords, episodes });
  } catch {
    return Response.json({ error: "Bölüm bilgileri alınamadı" }, { status: 502 });
  }
}