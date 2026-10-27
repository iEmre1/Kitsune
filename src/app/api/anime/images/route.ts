import { ANILIST_ENDPOINT } from "@/lib/anilist-shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids
            .map(Number)
            .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
      ).slice(0, 50)
    : [];
  if (!ids.length) return Response.json({ images: [] });

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `query ($ids: [Int]) {
          Page(perPage: 50) {
            media(id_in: $ids, type: ANIME) {
              id
              coverImage { extraLarge large }
              bannerImage
            }
          }
        }`,
        variables: { ids },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ error: "AniList görselleri alınamadı" }, { status: 502 });
    }

    const payload = await response.json();
    const images = (payload?.data?.Page?.media || []).map((media: any) => ({
      id: Number(media.id),
      poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
      banner: media.bannerImage || null,
    }));

    return Response.json({ images });
  } catch {
    return Response.json({ error: "AniList görsellerine ulaşılamadı" }, { status: 502 });
  }
}