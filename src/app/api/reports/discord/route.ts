import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type ReportBody = {
  animeId?: unknown;
  animeTitle?: unknown;
  episodeNumber?: unknown;
  seasonNumber?: unknown;
  provider?: unknown;
  source?: unknown;
  pageUrl?: unknown;
};

const text = (value: unknown, fallback = "Bilinmiyor") => {
  const normalized = String(value ?? "").trim();
  return normalized.slice(0, 300) || fallback;
};

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.DISCORD_REPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({ error: "Hata bildirim servisi yapılandırılmamış." }, { status: 503 });
  }

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçersiz bildirim." }, { status: 400 });
  }

  const animeId = text(body.animeId, "Bilinmiyor");
  const animeTitle = text(body.animeTitle, "Bilinmeyen anime");
  const episodeNumber = text(body.episodeNumber, "Bilinmiyor");
  const seasonNumber = text(body.seasonNumber, "Bilinmiyor");
  const provider = text(body.provider, "Bilinmiyor");
  const source = text(body.source, "Bilinmiyor");
  const pageUrl = text(body.pageUrl, "Bilinmiyor");

  const payload = {
    username: "Animke Hata Bildirim",
    embeds: [
      {
        title: "Yeni hata bildiririldi",
        color: 0xe9376b,
        fields: [
          { name: "Anime", value: `${animeTitle}\nID: ${animeId}`, inline: false },
          { name: "Bölüm", value: episodeNumber, inline: true },
          { name: "Sezon", value: seasonNumber, inline: true },
          { name: "Sağlayıcı", value: provider, inline: true },
          { name: "Kaynak", value: source, inline: true },
          { name: "Sayfa", value: pageUrl, inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return Response.json({ error: "Bildirim Discord'a gönderilemedi." }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Bildirim servisine ulaşılamadı." }, { status: 502 });
  }
}
