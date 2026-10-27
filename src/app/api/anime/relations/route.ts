import { ANILIST_ENDPOINT } from "@/lib/anilist-shared";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ error: "Geçersiz anime ID'si" }, { status: 400 });
  }

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            relations {
              edges {
                relationType(version: 2)
                node {
                  id
                  type
                  title { english romaji native }
                  startDate { year }
                }
              }
            }
          }
        }`,
        variables: { id },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ error: "AniList ilişkileri alınamadı" }, { status: 502 });
    }

    const payload = await response.json();
    const relations = (payload?.data?.Media?.relations?.edges || [])
      .filter(
        (edge: any) =>
          edge.node?.type === "ANIME" &&
          (edge.relationType === "PREQUEL" ||
            edge.relationType === "SEQUEL" ||
            edge.relationType === "OTHER"),
      )
      .map((edge: any) => ({
        id: Number(edge.node.id),
        relationType: edge.relationType,
        year: edge.node.startDate?.year ?? null,
        title:
          edge.node.title?.english ||
          edge.node.title?.romaji ||
          edge.node.title?.native ||
          "",
      }));

    return Response.json({ relations });
  } catch {
    return Response.json({ error: "AniList ilişkilerine ulaşılamadı" }, { status: 502 });
  }
}