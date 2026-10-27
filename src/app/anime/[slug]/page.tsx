"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

import parse from "html-react-parser";
import Container from "@/components/container";
import AnimeCard from "@/components/anime-card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import WatchButton from "@/components/watch-button";
import { IAnime } from "@/types/anime";
import AnimeCarousel from "@/components/anime-carousel";
import AnimeEpisodes from "@/components/anime-episodes";
import CharacterCard from "@/components/common/character-card";
import { ROUTES } from "@/constants/routes";
import WatchTrailer from "@/components/watch-trailer";
import Select, { ISelectOptions } from "@/components/common/select";
import {
  Ban,
  BookmarkCheck,
  CheckCheck,
  Hand,
  Heart,
  TvMinimalPlay,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useGetAnimeDetails } from "@/query/get-anime-details";
import Loading from "@/app/loading";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";
import useBookMarks from "@/hooks/use-get-bookmark";
import ErrorState from "@/components/common/error-state";
import { fetchAnimeImages } from "@/lib/anilist-client";
import { trackEvent } from "@/lib/analytics";

const SelectOptions: ISelectOptions[] = [
  {
    value: "plan to watch",
    label: "Planlandı",
    icon: BookmarkCheck,
  },
  {
    value: "watching",
    label: "İzleniyor",
    icon: TvMinimalPlay,
  },
  {
    value: "completed",
    label: "Tamamlandı",
    icon: CheckCheck,
  },
  {
    value: "on hold",
    label: "Beklemede",
    icon: Hand,
  },
  {
    value: "dropped",
    label: "Bırakıldı",
    icon: Ban,
  },
];

const Page = () => {
  const { slug } = useParams();
  const {
    data: anime,
    isLoading,
    isError,
    refetch,
  } = useGetAnimeDetails(slug as string);
  const { auth } = useAuthStore();
  const { bookmarks, createOrUpdateBookMark } = useBookMarks({
    animeID: slug as string,
    page: 1,
    per_page: 1,
  });
  const normalizeStatus = (s?: string) =>
    s ? s.toLowerCase().replace(/_/g, " ").trim() : "";

  const [selected, setSelected] = useState(
    bookmarks?.[0]?.status ? normalizeStatus(bookmarks[0].status) : "",
  );
  const [bannerSrc, setBannerSrc] = useState("");
  const [triedApiBanner, setTriedApiBanner] = useState(false);
  const trackedAnimeId = useRef("");

  useEffect(() => {
    const info = anime?.anime.info;
    if (!info || trackedAnimeId.current === info.id) return;
    trackedAnimeId.current = info.id;
    trackEvent("view_item", {
      item_id: info.id,
      item_name: info.name,
      content_type: "anime",
    });
  }, [anime?.anime.info.id, anime?.anime.info.name]);

  useEffect(() => {
    const source = anime?.anime.info.bannerImage || anime?.anime.info.poster || "";
    setBannerSrc(source);
    setTriedApiBanner(false);

    if (!source || source === "/icon.png") {
      setTriedApiBanner(true);
      void fetchAnimeImages(
        Number(anime?.anime.info.anilistId || anime?.anime.info.id),
      )
        .then((images) => setBannerSrc(images.banner || images.poster || "/icon.png"))
        .catch(() => setBannerSrc("/icon.png"));
    }
  }, [anime?.anime.info.id, anime?.anime.info.bannerImage, anime?.anime.info.poster]);

  useEffect(() => {
    const currentStatus = bookmarks?.[0]?.status;
    if (currentStatus) {
      const normalized = normalizeStatus(currentStatus);
      if (normalized !== selected) {
        setSelected(normalized);
      }
    }
  }, [bookmarks, selected]);

  const handleSelect = async (value: string) => {
    if (!auth) {
      return;
    }
    const previousSelected = selected;
    setSelected(value);

    try {
      await createOrUpdateBookMark(
        slug as string,
        anime?.anime.info.name!,
        anime?.anime.info.poster!,
        value,
      );
    } catch (error) {
      console.log(error);
      setSelected(previousSelected);
      toast.error("Listeye eklenirken hata oluştu", {
        style: { background: "red" },
      });
    }
  };

  if (isError) {
    return (
      <Container className="py-20">
        <ErrorState
          title="Anime bilgileri yüklenemedi"
          description="Anime bilgileri alınamadı."
          onRetry={() => refetch()}
          className="w-full"
        />
      </Container>
    );
  }

  return isLoading || !anime ? (
    <Loading />
  ) : (
    <div className="w-full z-50">
      <div className="h-[30vh] md:h-[40vh] w-full relative ">
        <Image
          src={bannerSrc || anime.anime.info.bannerImage || anime.anime.info.poster}
          alt={anime.anime.info.name}
          height={100}
          width={100}
          className="h-full w-full object-cover"
          unoptimized
          onError={async () => {
            if (triedApiBanner) {
              setBannerSrc("/icon.png");
              return;
            }
            setTriedApiBanner(true);
            try {
              const images = await fetchAnimeImages(
                Number(anime.anime.info.anilistId || anime.anime.info.id),
              );
              setBannerSrc(images.banner || images.poster || "/icon.png");
            } catch {
              setBannerSrc("/icon.png");
            }
          }}
        />

        <WatchTrailer
          videoHref={anime.anime.info.promotionalVideos[0]?.source}
        />
        <div className="absolute h-full w-full inset-0 m-auto bg-gradient-to-r from-slate-900 to-transparent"></div>
      </div>
      <Container className="z-50 md:space-y-10 pb-20">
        <div className="flex md:mt-[-9.375rem] mt-[-6.25rem] md:flex-row flex-col md:items-end md:gap-20 gap-10 ">
          <AnimeCard
            title={anime.anime.info.name}
            poster={anime.anime.info.poster}
            href={`${ROUTES.ANIME_DETAILS}/${anime.anime.info.id}`}
            displayDetails={false}
            variant="lg"
            className="shrink-0"
          />
          <div className="flex flex-col md:gap-5 gap-2 pb-16">
            <h1 className="md:text-5xl text-2xl md:font-black font-extrabold z-[9]">
              {anime.anime.info.name}
            </h1>
            <div className="flex items-center gap-5">
              <WatchButton />
              {auth && (
                <Select
                  placeholder="Listeme Ekle"
                  value={selected || normalizeStatus(bookmarks?.[0]?.status)}
                  options={SelectOptions}
                  onChange={handleSelect}
                  placeholderIcon={Heart}
                />
              )}
            </div>
          </div>
        </div>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex h-fit w-fit items-center justify-start gap-5 px-2 text-2xl md:gap-8">
            <TabsTrigger
              value="overview"
              className="md:text-2xl text-lg font-semibold"
            >
              Genel Bakış
            </TabsTrigger>

            <TabsTrigger
              value="episodes"
              className="md:text-2xl text-lg font-semibold"
            >
              Bölümler
            </TabsTrigger>
            {anime.anime.info.charactersVoiceActors.length > 0 && (
              <TabsTrigger
                value="characters"
                className="md:text-2xl text-lg font-semibold"
              >
                Karakterler
              </TabsTrigger>
            )}
            {anime.seasons.length > 0 && (
              <TabsTrigger
                value="relations"
                className="md:text-2xl text-lg font-semibold"
              >
                İlişkiler
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="overview"
            className="w-full grid md:grid-cols-5 grid-cols-1 gap-x-20 gap-y-5 mt-10"
          >
            <div className="col-span-1 flex flex-col gap-5 w-full">
              <h3 className="text-xl font-semibold">Detaylar</h3>
              <div className="grid grid-cols-2 w-full md:text-base text-xs gap-y-2 gap-x-20 md:gap-x-0">
                <h3>Yayın Tarihi</h3>
                <span>{anime.anime.moreInfo.aired}</span>

                <h3>Derecelendirme</h3>
                <span>{anime.anime.info.stats.rating}</span>

                <h3>Türler</h3>
                <span>{anime.anime.moreInfo.genres.join(", ")}</span>

                <h3>Format</h3>
                <span>{anime.anime.info.stats.type}</span>

                <h3>Durum</h3>
                <span>{anime.anime.moreInfo.status}</span>

                <h3>Sezon</h3>
                <span className="capitalize">{}</span>

                <h3>Stüdyolar</h3>
                <span>{anime.anime.moreInfo.studios}</span>
              </div>
            </div>
            <div className="col-span-4 flex flex-col gap-5">
              <h3 className="text-xl font-semibold">Açıklama</h3>
              <div className="md:text-base text-xs leading-6 text-gray-300">
                {parse(anime.anime.info.description || "")}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="relations"
            className="w-full flex flex-col gap-5 "
          >
            <h3 className="text-xl font-semibold">İlişkiler</h3>
            <div className="grid lg:grid-cols-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 w-full gap-5 content-center">
              {anime.seasons.map((relation, idx) => {
                return (
                  !relation.isCurrent && (
                    <AnimeCard
                      key={idx}
                      title={relation.name}
                      subTitle={relation.title}
                      poster={relation.poster}
                      className="self-center justify-self-center"
                      href={`${ROUTES.ANIME_DETAILS}/${relation.id}`}
                    />
                  )
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="episodes" className="flex flex-col gap-5">
            <AnimeEpisodes animeId={anime.anime.info.id} />
          </TabsContent>
          {!!anime.anime.info.charactersVoiceActors.length && (
            <TabsContent
              value="characters"
              className="w-full flex flex-col gap-5 "
            >
              <h3 className="text-xl font-semibold">Anime Karakterleri</h3>
              <div className="grid lg:grid-cols-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 w-full gap-5 content-center">
                {anime.anime.info.charactersVoiceActors.map(
                  (character, idx) => {
                    return (
                      <CharacterCard
                        key={idx}
                        character={character}
                        className="self-center justify-self-center"
                      />
                    );
                  },
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {!!anime.recommendedAnimes.length && (
          <AnimeCarousel
            anime={anime.recommendedAnimes as IAnime[]}
            title="Önerilenler"
            className="pt-20"
          />
        )}
      </Container>
    </div>
  );
  //eslint-disable-next-line
};

export default Page;
