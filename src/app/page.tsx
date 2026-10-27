"use client";

import ContinueWatching from "@/components/continue-watching";
import FeaturedCollection from "@/components/featured-collection";
import { useGetHomepageAnime } from "@/query/get-homepage-anime";
import dynamic from "next/dynamic";

// Dynamically import components
const HeroSection = dynamic(() => import("@/components/hero-section"));
const LatestEpisodesAnime = dynamic(
  () => import("@/components/latest-episodes-section"),
);
const AnimeSchedule = dynamic(() => import("@/components/anime-schedule"));
const AnimeSections = dynamic(() => import("@/components/anime-sections"));

import React, { useState, useMemo } from "react";

import RecentCommentsSection from "@/components/recent-comments-section";
import { MediaList } from "@/types/miruro-api";

export default function Home() {
  const [trendingPage, setTrendingPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);

  const {
    data: homepageData,
    isLoading,
    isError,
    refetch,
  } = useGetHomepageAnime(trendingPage, upcomingPage, 14);
  const spotlightList = homepageData?.spotlight || [];
  const recentRes = homepageData?.recent;
  const popularRes = homepageData?.popular;
  const trendingRes = homepageData?.trending;
  const upcomingRes = homepageData?.upcoming;

  const uniqueById = (items: MediaList[] = []): MediaList[] => {
    const seen = new Set<number>();
    return items.filter((item: MediaList) => {
      const key = Number(item.id);
      if (!Number.isFinite(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const recentList = uniqueById(recentRes?.results || []);
  const popularList = uniqueById(popularRes?.results || []);
  const fallbackPopularList = uniqueById(
    popularList.length ? popularList : trendingRes?.results || [],
  );
  const fallbackTrendingList = uniqueById(
    trendingRes?.results?.length ? trendingRes.results : fallbackPopularList,
  );
  const fallbackUpcomingList = uniqueById(
    upcomingRes?.results?.length ? upcomingRes.results : fallbackPopularList,
  );

  const trendingList = uniqueById(
    trendingRes?.results?.length ? trendingRes.results : fallbackTrendingList,
  );
  const upcomingList = uniqueById(
    upcomingRes?.results?.length ? upcomingRes.results : fallbackUpcomingList,
  );

  // Store first 3 records into dedicated variables so pagination page changes in other sections don't re-trigger FeaturedCollection
  const featuredFavoriteList = useMemo(
    () => uniqueById(popularList.length ? popularList : fallbackPopularList).slice(0, 3),
    [popularList.length > 0 ? popularList[0]?.id : null, fallbackPopularList.length],
  );
  const featuredPopularList = useMemo(
    () => uniqueById(popularList.length ? popularList : fallbackPopularList).slice(3, 6),
    [popularList.length > 0 ? popularList[0]?.id : null, fallbackPopularList.length],
  );
  const featuredRecentList = useMemo(
    () => uniqueById(recentList.length ? recentList : fallbackPopularList).slice(0, 3),
    [recentList.length > 0 ? recentList[0]?.id : null, fallbackPopularList.length],
  );

  return (
    <div className="flex flex-col bg-[#121212]">
      <HeroSection
        spotlightAnime={spotlightList}
        isDataLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      <LatestEpisodesAnime />

      <ContinueWatching loading={false} />

      <FeaturedCollection
        loading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        featuredAnime={[
          {
            title: "En Çok Sevilen Anime",
            anime: featuredFavoriteList,
          },
          {
            title: "En Popüler Anime",
            anime: featuredPopularList,
          },
          {
            title: "En Son Eklenenler",
            anime: featuredRecentList,
          },
        ]}
      />

      <AnimeSections
        title="Trendlerdeki Anime"
        animeList={trendingList}
        loading={isLoading}
        page={trendingPage}
        hasNextPage={trendingRes?.hasNextPage}
        onPageChange={(p) => setTrendingPage(p)}
        isError={isError}
        onRetry={() => refetch()}
      />

      <RecentCommentsSection />

      <AnimeSchedule />

      <AnimeSections
        title="Yakında Gelecek Anime"
        animeList={upcomingList}
        loading={isLoading}
        page={upcomingPage}
        hasNextPage={upcomingRes?.hasNextPage}
        onPageChange={(p) => setUpcomingPage(p)}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  );
}
