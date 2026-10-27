"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import EpisodeCard from "./common/episode-card";
import { useGetAllEpisodes } from "@/query/get-all-episodes";
import { useGetAnimeSeasons } from "@/query/get-anime-seasons";
import { Episode } from "@/types/episodes";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Props = {
  animeId: string;
};

const AnimeEpisodes = ({ animeId }: Props) => {
  const [selectedSeason, setSelectedSeason] = useState("1");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [ranges, setRanges] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: seasons = [] } = useGetAnimeSeasons(animeId);
  const seasonOptions = seasons.length
    ? seasons
    : [{ value: "1", label: "Sezon 1", seasonNumber: 1 }];
  const selectedSeasonNumber =
    seasonOptions.find((season) => season.value === selectedSeason)?.seasonNumber || 1;
  const { data, isLoading, isError, refetch } = useGetAllEpisodes(
    animeId,
    animeId,
    selectedSeasonNumber,
  );

  useEffect(() => {
    setSelectedSeason("1");
  }, [animeId]);

  useEffect(() => {
    if (data) {
      const episodes = data.episodes;
      setAllEpisodes(episodes);
      setSelectedRange(`1-${Math.min(50, episodes.length)}`);
      setSearch("");

      if (episodes.length > 50) {
        // Calculate ranges
        const rangesArray = [];
        for (let i = 0; i < episodes.length; i += 50) {
          const start = i + 1;
          const end = Math.min(i + 50, episodes.length);
          rangesArray.push(`${start}-${end}`);
        }
        setRanges(rangesArray);
        setSelectedRange(rangesArray[0]);

        // Filter the first range directly from episodes
        const filteredEpisodes = episodes.filter(
          (_, index) => index + 1 >= 1 && index + 1 <= 50,
        );
        setEpisodes(filteredEpisodes);
      } else {
        setRanges([]);
        setEpisodes(episodes);
      }
    }
  }, [data]);

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);

    const [start, end] = range.split("-").map(Number);
    const filteredEpisodes = allEpisodes.filter(
      (_, index) => index + 1 >= start && index + 1 <= end,
    );
    setEpisodes(filteredEpisodes);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearch(e.target.value);
    if (!query) {
      // Reset episodes to the selected range
      const [start, end] = selectedRange.split("-").map(Number);
      const filteredEpisodes = allEpisodes.filter(
        (_, index) => index + 1 >= start && index + 1 <= end,
      );
      setEpisodes(filteredEpisodes);
    } else {
      const filteredEpisodes = allEpisodes.filter((episode, index) => {
        return (
          (index + 1).toString().includes(query) ||
          episode.title.toLowerCase().includes(query) ||
          "episode".includes(query.trim())
        );
      });
      setEpisodes(filteredEpisodes);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold">Bölümler</h3>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <Select
            value={selectedSeason}
            onValueChange={(value) => {
              setSelectedSeason(value);
              setEpisodes([]);
              setAllEpisodes([]);
              setRanges([]);
              setSelectedRange("");
              setSearch("");
            }}
          >
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue placeholder="Sezon seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {seasonOptions.map((season) => (
                  <SelectItem key={season.value} value={season.value}>
                    {season.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {ranges.length > 0 && (
            <Select onValueChange={handleRangeChange} value={selectedRange}>
              <SelectTrigger className="w-[105px] shrink-0">
                <SelectValue
                  className="text-white"
                  placeholder="Aralık Seç"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ranges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <div className="relative min-w-[10rem] max-w-[21.875rem] flex-1">
            <Search className="absolute inset-y-0 left-2 m-auto h-4 w-4" />
            <Input
              placeholder="Bölüm ara..."
              value={search}
              className="w-full pl-8 text-white border-white"
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-5 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 w-full gap-5 content-center">
        {episodes.map((episode, idx) => (
          <EpisodeCard
            episode={episode}
            key={idx}
            className="self-center justify-self-center"
            animeId={animeId}
            seriesAnimeId={animeId}
            seasonNumber={selectedSeasonNumber}
          />
        ))}
        {!episodes.length && !isLoading && (
          <div className="col-span-full flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-6 text-center">
            <AlertCircle className="h-5 w-5 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">
              {isError ? "Bölümler şu anda yüklenemiyor" : "Henüz çevrilmiş bölüm yok"}
            </p>
            <p className="text-xs text-slate-400">
              {isError
                ? "Bağlantınızı kontrol edip yeniden deneyebilirsiniz."
                : "Bu anime için yeni bir çeviri eklendiğinde burada görünecek."}
            </p>
            {isError && (
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-1 inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Yeniden dene
              </button>
            )}
          </div>
        )}
        {isLoading &&
          Array.from({ length: 14 }).map((_, idx) => (
            <div
              key={idx}
              className={cn([
                "h-[6.25rem] rounded-lg cursor-pointer w-full flex items-center justify-center animate-pulse bg-slate-800",
                "self-center justify-self-center",
              ])}
            ></div>
          ))}
      </div>
    </>
  );
};

export default AnimeEpisodes;
