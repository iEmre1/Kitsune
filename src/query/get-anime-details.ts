"use client";

import { fetchAnimeImages, fetchAnimeInfo } from "@/lib/anilist-client";
import { GET_ANIME_DETAILS } from "@/constants/query-keys";
import {
  getPocketBaseAnimeByAniListId,
  getPocketBaseImageUrl,
} from "@/lib/pocketbase-anime";
import { IAnimeDetails } from "@/types/anime-details";
import { useQuery } from "@tanstack/react-query";

const parseTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Text fields may store lists as comma-separated values instead of JSON.
  }

  return value.split(/[,\n|]/).map((item) => item.trim()).filter(Boolean);
};

const getAnimeDetails = async (animeId: string): Promise<IAnimeDetails> => {
  const id = Number(animeId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Geçersiz anime ID'si");
  }

  try {
    const media = await getPocketBaseAnimeByAniListId(id);
    if (!media) throw new Error("Anime PocketBase kataloğunda bulunamadı");
    const title = media.name_english || media.name || media.name_romaji || media.original_title || "Untitled";
    const genres = parseTextList(media.anilist_genres);
    const synonyms = parseTextList(media.synonyms).join(", ");
    const episodeCount = Number(media.episode_count) || 0;
    const runtime = Number(media.runtime) || 0;
    const score = Number(media.anilist_score) || 0;
    const trailer = typeof media.trailer === "string" ? media.trailer.trim() : "";
    let apiImages: { poster: string | null; banner: string | null } = {
      poster: null,
      banner: null,
    };
    try {
      apiImages = await fetchAnimeImages(id);
    } catch {
      // Use the PocketBase image when the AniList image query is unavailable.
    }

    return {
      anime: {
        info: {
          id: String(media.anilist_id || id),
          anilistId: Number(media.anilist_id) || id,
          malId: Number(media.mal_id) || 0,
          name: title,
          poster:
            apiImages.poster || getPocketBaseImageUrl(media, media.poster),
          bannerImage:
            apiImages.banner ||
            apiImages.poster ||
            getPocketBaseImageUrl(media, media.banner || media.poster),
          description: media.description || "",
          stats: {
            rating: score ? `${score}%` : "N/A",
            quality: "HD",
            episodes: { sub: episodeCount, dub: episodeCount },
            type: media.format || "N/A",
            duration: runtime ? `${runtime} min` : "N/A",
          },
          promotionalVideos: trailer
            ? [{ title: "Fragman", source: trailer, thumbnail: "" }]
            : [],
          charactersVoiceActors: [],
        },
        moreInfo: {
          japanese: media.original_title || media.name_romaji || "",
          synonyms,
          aired: media.release_date || "N/A",
          premiered: Number(media.season_count) ? `${media.season_count} sezon` : "N/A",
          duration: runtime ? `${runtime} min` : "N/A",
          status: media.anilist_status || "N/A",
          malscore: score ? String(score) : "N/A",
          genres,
          studios: media.studio || "N/A",
          producers: [],
        },
      },
      seasons: [],
      mostPopularAnimes: [],
      relatedAnimes: [],
      recommendedAnimes: [],
    };
  } catch {
    const apiMedia = await fetchAnimeInfo(id);
    if (!apiMedia) {
      throw new Error("Anime bilgileri alınamadı");
    }

    const title =
      apiMedia.title?.english ||
      apiMedia.title?.romaji ||
      apiMedia.title?.native ||
      "Untitled";
    const trailerSource =
      apiMedia.trailer?.site === "youtube" && apiMedia.trailer?.id
        ? `https://www.youtube.com/watch?v=${apiMedia.trailer.id}`
        : apiMedia.trailer?.thumbnail || "";

    return {
      anime: {
        info: {
          id: String(apiMedia.id),
          anilistId: Number(apiMedia.id) || id,
          malId: Number(apiMedia.idMal) || 0,
          name: title,
          poster: apiMedia.coverImage?.extraLarge || apiMedia.coverImage?.large || "/icon.png",
          bannerImage: apiMedia.bannerImage || apiMedia.coverImage?.extraLarge || "/icon.png",
          description: apiMedia.description || "",
          stats: {
            rating: apiMedia.averageScore ? `${apiMedia.averageScore}%` : "N/A",
            quality: "HD",
            episodes: {
              sub: apiMedia.episodes || 0,
              dub: apiMedia.episodes || 0,
            },
            type: apiMedia.format || "N/A",
            duration: apiMedia.duration ? `${apiMedia.duration} min` : "N/A",
          },
          promotionalVideos: trailerSource
            ? [{ title: "Fragman", source: trailerSource, thumbnail: apiMedia.trailer?.thumbnail || "" }]
            : [],
          charactersVoiceActors: [],
        },
        moreInfo: {
          japanese: apiMedia.title?.native || "",
          synonyms: (apiMedia.synonyms || []).join(", ") || "N/A",
          aired: apiMedia.startDate?.year
            ? `${apiMedia.startDate.year}`
            : "N/A",
          premiered: apiMedia.season ? `${apiMedia.season} sezon` : "N/A",
          duration: apiMedia.duration ? `${apiMedia.duration} min` : "N/A",
          status: apiMedia.status || "N/A",
          malscore: apiMedia.averageScore ? String(apiMedia.averageScore) : "N/A",
          genres: apiMedia.genres || [],
          studios: apiMedia.studios?.nodes?.map((item) => item.name).join(", ") || "N/A",
          producers: [],
        },
      },
      seasons: [],
      mostPopularAnimes: [],
      relatedAnimes: [],
      recommendedAnimes: [],
    };
  }
};

export const useGetAnimeDetails = (animeId: string) => {
  return useQuery({
    queryFn: () => getAnimeDetails(animeId),
    queryKey: [GET_ANIME_DETAILS, animeId],
    enabled: !!animeId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

