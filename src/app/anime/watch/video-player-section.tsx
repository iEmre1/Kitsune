"use client";

import React, { useEffect, useState } from "react";
import { useAnimeStore } from "@/store/anime-store";
import dynamic from "next/dynamic";

const KitsunePlayer = dynamic(() => import("@/components/kitsune-player"), {
  ssr: false,
});
import { useGetEpisodeData } from "@/query/get-episode-data";
import { Captions, Mic, AlertCircle, Server } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

import { useGetAllEpisodes } from "@/query/get-all-episodes";
import { useGetSourceAvailable } from "@/query/get-source-available";

const VideoPlayerSection = () => {
  const searchParams = useSearchParams();
  const animeIdParam = searchParams.get("anime") || "";
  const seriesAnimeIdParam = searchParams.get("series") || animeIdParam;
  const seasonNumberParam = Number(searchParams.get("season")) || undefined;
  const epParam = searchParams.get("ep");
  const episodeIdParam = searchParams.get("episode") || "";
  const { selectedEpisode, setSelectedEpisode, anime } = useAnimeStore();

  const { data: isSourceAvailable } = useGetSourceAvailable();
  const { data: allEpisodesData, isLoading: isLoadingEpisodes } =
    useGetAllEpisodes(animeIdParam, seriesAnimeIdParam, seasonNumberParam);

  const [pbPlayerUrl, setPbPlayerUrl] = useState<string | null>(null);
  const [pbPlayerNotice, setPbPlayerNotice] = useState<string | null>(null);
  const [pbFansubs, setPbFansubs] = useState<
    Array<{
      id: string;
      fansubName: string;
      displayName: string;
      playerUrl: string;
      fansubRaw?: string;
      sources: Array<{ id: string; url: string; label: string }>;
    }>
  >([]);
  const [selectedPbSourceId, setSelectedPbSourceId] = useState<string | null>(null);

  useEffect(() => {
  }, []);

  // Match episode number from ?ep= parameter if present
  const targetEpByNumber =
    epParam && allEpisodesData?.episodes
      ? allEpisodesData.episodes.find((e) => e.number === Number(epParam))
      : null;

  // Resolve active episode ID prioritizing selectedEpisode or ?ep= parameter
  const providerEpisodeIds = React.useMemo(() => {
    const providers = allEpisodesData?.rawResponse?.providers || {};
    return new Set(
      Object.values(providers).flatMap((provider: any) =>
        [
          ...(provider?.episodes?.sub || []),
          ...(provider?.episodes?.dub || []),
        ].map((episode: any) => String(episode.id)),
      ),
    );
  }, [allEpisodesData?.rawResponse?.providers]);

  const episodeCandidates = [
    targetEpByNumber?.episodeId,
    episodeIdParam,
    selectedEpisode,
    !epParam && !episodeIdParam ? allEpisodesData?.episodes?.[0]?.episodeId : "",
  ].filter(Boolean) as string[];
  const activeEpisodeId =
    episodeCandidates.find((id) => providerEpisodeIds.has(id)) || "";
  const isEpisodeInPocketBase = Boolean(activeEpisodeId);

  // Sync selectedEpisode in store when ?ep= parameter changes
  useEffect(() => {
    if (!targetEpByNumber?.episodeId) return;
    const parts = (selectedEpisode || "").replace(/^\//, "").split("/");
    const selEpNum = parts[4] ? Number(parts[4].split("-").pop()) : Number(selectedEpisode);
    if (!selectedEpisode || selEpNum !== targetEpByNumber.number) {
      const providers = allEpisodesData?.rawResponse?.providers || {};
      const curProv = parts[1];
      const curCat = (parts[3] === "dub" ? "dub" : "sub") as "sub" | "dub";
      const matchInCurProv = curProv
        ? providers[curProv]?.episodes?.[curCat]?.find(
            (e: any) => Number(e.number) === targetEpByNumber.number,
          )
        : null;
      setSelectedEpisode(matchInCurProv?.id || targetEpByNumber.episodeId);
      setUseFallback(false);
    }
  }, [
    targetEpByNumber?.episodeId,
    targetEpByNumber?.number,
    selectedEpisode,
    allEpisodesData?.rawResponse?.providers,
    setSelectedEpisode,
  ]);

  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [failedEpisodeIds, setFailedEpisodeIds] = useState<Set<string>>(new Set());

  const { data: episodeData, isLoading: isLoadingData } = useGetEpisodeData(
    activeEpisodeId,
    isEpisodeInPocketBase && activeEpisodeId.includes("watch/"),
  );

  const [autoSkip, setAutoSkip] = useState<boolean>(true);
  const [preferredCategory, setPreferredCategory] = useState<"sub" | "dub">("sub");

  useEffect(() => {
    const storedSkip = localStorage.getItem("autoSkip");
    if (storedSkip !== null) setAutoSkip(storedSkip === "true");

    const storedCategory = localStorage.getItem("preferredCategory");
    if (storedCategory === "sub" || storedCategory === "dub") {
      setPreferredCategory(storedCategory);
    }
  }, []);

  function onHandleAutoSkipChange(value: boolean) {
    setAutoSkip(value);
    localStorage.setItem("autoSkip", JSON.stringify(value));
  }

  // Extract dynamic providers from EpisodeResponse
  const rawProviders = React.useMemo(
    () => allEpisodesData?.rawResponse?.providers || {},
    [allEpisodesData?.rawResponse?.providers],
  );
  const providerNames = React.useMemo(
    () => Object.keys(rawProviders),
    [rawProviders],
  );

  useEffect(() => {
    const loadPbPlayer = async () => {
      const parts = activeEpisodeId.replace(/^\//, "").split("/");
      const provName = parts[1] || providerNames[0] || "";
      const epNum =
        allEpisodesData?.episodes?.find((e) => e.episodeId === activeEpisodeId)
          ?.number ||
        Number(parts[4]?.split("-").pop()) ||
        Number(epParam) ||
        1;
      if (!animeIdParam || !epNum) {
        setPbPlayerUrl(null);
        setPbPlayerNotice(null);
        setPbFansubs([]);
        setSelectedPbSourceId(null);
        return;
      }
      try {
        const items = Object.values(rawProviders)
          .flatMap((provider: any) => [
            ...(provider?.episodes?.sub || []),
            ...(provider?.episodes?.dub || []),
          ])
          .filter((record: any) => Number(record.number) === Number(epNum));
        if (items.length === 0) {
          setPbFansubs([]);
          setSelectedPbSourceId(null);
          setPbPlayerUrl(null);
          setPbPlayerNotice(null);
          return;
        }

        const fansubs = items
          .map((rec: any) => {
            const sources: Array<{ id: string; url: string; label: string }> = [];
            const p1 = rec.player_url;
            if (p1 && String(p1).trim() !== "") {
              sources.push({ id: `${rec.id}-main`, url: String(p1).trim(), label: "Ana Kaynak" });
            } else {
              const p1b = rec.player_url1;
              if (p1b && String(p1b).trim() !== "") {
                sources.push({ id: `${rec.id}-main`, url: String(p1b).trim(), label: "Ana Kaynak" });
              }
            }
            const p2 = rec.player_url2;
            if (p2 && String(p2).trim() !== "") {
              sources.push({ id: `${rec.id}-1`, url: String(p2).trim(), label: "Kaynak 2" });
            }
            const p3 = rec.player_url3;
            if (p3 && String(p3).trim() !== "") {
              sources.push({ id: `${rec.id}-2`, url: String(p3).trim(), label: "Kaynak 3" });
            }
            const translatorName = rec.translator_name || rec.translator || rec.translatorName;
            const fansubRaw = rec.fansub_name || rec.fansub || rec.team || rec.group || null;
            const displayName = translatorName
              ? String(translatorName)
              : fansubRaw
              ? String(fansubRaw)
              : "Bilinmiyor";
            const fansubName = fansubRaw ? String(fansubRaw) : displayName;
            return {
              id: rec.id,
              fansubName: fansubName,
              displayName: displayName,
              playerUrl: sources[0]?.url || "",
              fansubRaw: fansubRaw ? String(fansubRaw) : undefined,
              sources,
            };
          })
          .filter((f) => f.sources.length > 0);

        if (fansubs.length === 0) {
          setPbFansubs([]);
          setSelectedPbSourceId(null);
          setPbPlayerUrl(null);
          setPbPlayerNotice("Bu bölüm için henüz kayıtlı bir oynatıcı bağlantısı yok.");
          return;
        }

        // unique by fansub name preserving first occurrence
        const seen = new Set<string>();
        const uniqueFansubs: typeof fansubs = [];
        for (const f of fansubs) {
          const key = f.fansubName.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueFansubs.push(f);
          }
        }

        setPbFansubs(uniqueFansubs);

        let preferred = uniqueFansubs.find(
          (f) =>
            f.fansubName.trim().toLowerCase() ===
            provName.trim().toLowerCase(),
        );
        if (!preferred) {
          preferred = uniqueFansubs[0];
        }

        const firstSrc = preferred.sources?.[0];
        setSelectedPbSourceId(firstSrc?.id || null);
        setPbPlayerUrl(firstSrc?.url || preferred.playerUrl);
        setPbPlayerNotice(null);
      } catch (e) {
        setPbFansubs([]);
        setSelectedPbSourceId(null);
        setPbPlayerUrl(null);
        setPbPlayerNotice(null);
      }
    };
    loadPbPlayer();
  }, [animeIdParam, activeEpisodeId, providerNames, rawProviders, allEpisodesData, epParam]);

  // PB fansubleri yukarıda tanımlanmalı
  const activePbFansubLocal = pbFansubs.find((f: any) =>
    (f.sources || []).some((src: any) => src.id === selectedPbSourceId),
  ) || pbFansubs.find((f: any) => f.sources?.[0]?.id === selectedPbSourceId) || pbFansubs[0] || null;
  const cleanParts = activeEpisodeId.replace(/^\//, "").split("/");
  const currentProviderName = cleanParts[1] || providerNames[0] || "";
  const activeCategory: "sub" | "dub" =
    cleanParts[3] === "dub" ? "dub" : preferredCategory;

  const parsedEpFromSlug = cleanParts[4]
    ? Number(cleanParts[4].split("-").pop())
    : NaN;
  const currentEpNumber =
    allEpisodesData?.episodes?.find((e) => e.episodeId === activeEpisodeId)
      ?.number ||
    (Number.isFinite(parsedEpFromSlug) && parsedEpFromSlug > 0
      ? parsedEpFromSlug
      : Number(epParam) || 1);

  // Reset failed providers when switching to a different episode number
  useEffect(() => {
    setFailedEpisodeIds(new Set());
  }, [currentEpNumber, animeIdParam]);

  // Synchronize activeEpisodeId category with preferredCategory ("sub" or "dub")
  useEffect(() => {
    if (!providerNames.length || !activeEpisodeId.includes("watch/")) return;

    const slugCategory = cleanParts[3] === "dub" ? "dub" : "sub";
    if (slugCategory !== preferredCategory) {
      for (const pName of providerNames) {
        const pData = rawProviders[pName]?.episodes?.[preferredCategory] || [];
        const targetEp = pData.find(
          (ep: any) => Number(ep.number) === currentEpNumber,
        );
        if (targetEp?.id) {
          setSelectedEpisode(targetEp.id);
          break;
        }
      }
    }
  }, [
    currentEpNumber,
    preferredCategory,
    providerNames,
    rawProviders,
    activeEpisodeId,
    cleanParts,
    setSelectedEpisode,
  ]);

  // Try next available provider when current provider fails or returns 0 streams
  const tryNextProviderOrFallback = React.useCallback(() => {
    const nextFailed = new Set(failedEpisodeIds);
    if (activeEpisodeId) nextFailed.add(activeEpisodeId);
    setFailedEpisodeIds(nextFailed);

    for (const pName of providerNames) {
      const pData = rawProviders[pName]?.episodes?.[activeCategory] || [];
      const candidate = pData.find(
        (ep: any) => Number(ep.number) === currentEpNumber,
      );
      if (candidate?.id && !nextFailed.has(candidate.id)) {
        setSelectedEpisode(candidate.id);
        return;
      }
    }
    setUseFallback(true);
  }, [
    failedEpisodeIds,
    activeEpisodeId,
    providerNames,
    rawProviders,
    activeCategory,
    currentEpNumber,
    setSelectedEpisode,
  ]);

  // Auto-advance if non-loading episodeData returned 0 playable sources
  useEffect(() => {
    if (
      !useFallback &&
      !isLoadingData &&
      activeEpisodeId.includes("watch/") &&
      episodeData &&
      (!episodeData.sources || episodeData.sources.length === 0)
    ) {
      tryNextProviderOrFallback();
    }
  }, [
    useFallback,
    isLoadingData,
    activeEpisodeId,
    episodeData,
    tryNextProviderOrFallback,
  ]);

  const isFallbackActive =
    useFallback ||
    !activeEpisodeId.includes("watch/") ||
    (!isLoadingData && (!episodeData || !episodeData.sources?.length));

  const handleProviderSelect = (pName: string, category: "sub" | "dub") => {
    setPreferredCategory(category);
    localStorage.setItem("preferredCategory", category);
    setUseFallback(false);
    setPbPlayerUrl(null);
    setPbFansubs([]);
    setSelectedPbSourceId(null);
    setPbPlayerNotice(null);

    const pData = rawProviders[pName]?.episodes?.[category] || [];
    const targetEp =
      pData.find((ep: any) => Number(ep.number) === currentEpNumber) || pData[0];
    if (targetEp?.id) {
      setFailedEpisodeIds((prev) => {
        const next = new Set(prev);
        next.delete(targetEp.id);
        return next;
      });
      setSelectedEpisode(targetEp.id);
    }
  };

  if (isLoadingEpisodes || (isLoadingData && !useFallback)) {
    return (
      <div className="h-auto aspect-video lg:max-h-[calc(100vh-150px)] min-h-[20vh] sm:min-h-[30vh] md:min-h-[40vh] lg:min-h-[60vh] w-full animate-pulse bg-slate-800 rounded-xl"></div>
    );
  }

  if (!activeEpisodeId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-sm text-gray-300">
        Bu bölüm için kayıtlı bir oynatma bilgisi bulunamadı.
      </div>
    );
  }

  const subProvidersForEp = providerNames.filter((pName) =>
    (rawProviders[pName]?.episodes?.sub || []).some(
      (ep: any) => Number(ep.number) === currentEpNumber,
    ),
  );
  const dubProvidersForEp = providerNames.filter((pName) =>
    (rawProviders[pName]?.episodes?.dub || []).some(
      (ep: any) => Number(ep.number) === currentEpNumber,
    ),
  );

  const nextAiring = allEpisodesData?.nextAiringEpisode;
  const nextAiringDays = nextAiring
    ? Math.floor(nextAiring.timeUntilAiring / 86400)
    : 0;
  const nextAiringHours = nextAiring
    ? Math.floor((nextAiring.timeUntilAiring % 86400) / 3600)
    : 0;

  return (
    <div className="flex flex-col gap-3 w-full">
      {pbPlayerUrl ? (
        <div className="relative w-full h-0 pb-[56.25%] max-h-[500px] lg:max-h-[calc(100vh-150px)] bg-black overflow-hidden rounded-xl border border-slate-800">
          <iframe
            key={`pb-${animeIdParam}-${currentEpNumber}-${selectedPbSourceId || currentProviderName}`}
            src={pbPlayerUrl}
            width="100%"
            height="100%"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="no-referrer-when-downgrade"
            scrolling="no"
            className="absolute top-0 left-0 w-full h-full border-0"
          ></iframe>
        </div>
      ) : isFallbackActive || !episodeData ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-4 text-center text-sm text-gray-300">
          Bu bölüm için henüz oynatılabilir bir çeviri veya kaynak eklenmemiş.
        </div>
      ) : (
        <KitsunePlayer
          key={`${activeEpisodeId}-${episodeData.sources?.[0]?.url}`}
          episodeInfo={episodeData}
          serversData={{
            episodeId: activeEpisodeId,
            episodeNo: String(currentEpNumber),
            sub: subProvidersForEp.map((p, idx) => ({
              serverId: idx + 1,
              serverName: p,
            })),
            dub: dubProvidersForEp.map((p, idx) => ({
              serverId: idx + 1,
              serverName: p,
            })),
            raw: [],
          }}
          animeInfo={{
            id: String(animeIdParam || anime?.anime?.info?.id || "0"),
            title: anime?.anime?.info?.name || "Anime",
            image: anime?.anime?.info?.poster || "",
          }}
          subOrDub={activeCategory}
          autoSkip={autoSkip}
          onError={tryNextProviderOrFallback}
        />
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full p-5 bg-[#0f172a] border border-slate-800 rounded-xl">
        <div className="flex flex-col gap-3 w-full md:w-auto">
          {pbFansubs.length > 0 && (
            <div className="flex flex-col gap-2">
              {activePbFansubLocal?.fansubRaw && (
                <p className="text-xs text-gray-400">{activePbFansubLocal.fansubRaw}</p>
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                <Captions className="text-red-400 h-4 w-4 shrink-0" />
                <p className="font-bold text-xs text-gray-300 tracking-wider">
                  SUNUCULAR (FANSUBLAR):
                </p>
                {pbFansubs.map((f: any) => {
                  const isActive = activePbFansubLocal?.id === f.id;
                  const fansubImg = f.image || f.logo || f.avatar || f.fansub_image || f.photo;
                  return (
                    <Button
                      size="sm"
                      key={f.id}
                      className={`font-bold text-xs px-3 transition-all flex items-center gap-2 ${
                        isActive
                          ? "bg-[#e9376b] text-white shadow-md ring-2 ring-[#e9376b]/40 scale-105"
                          : "bg-slate-800/80 text-gray-300 hover:bg-slate-700 hover:text-white"
                      }`}
                      onClick={() => {
                        setSelectedPbSourceId(null);
                        const firstSrc = f.sources?.[0];
                        if (firstSrc) {
                          setSelectedPbSourceId(firstSrc.id);
                          setPbPlayerUrl(firstSrc.url);
                        } else if (f.playerUrl) {
                          setPbPlayerUrl(f.playerUrl);
                        }
                        setPbPlayerNotice(null);
                      }}
                    >
                      {fansubImg ? (
                        <img src={fansubImg} alt={f.displayName || f.fansubName} className="w-4 h-4 rounded-full object-cover" />
                      ) : null}
                      {f.displayName || f.fansubName || "Bilinmiyor"}
                    </Button>
                  );
                })}
              </div>
              {activePbFansubLocal && activePbFansubLocal.sources && activePbFansubLocal.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Server className="text-blue-400 h-4 w-4 shrink-0" />
                  <p className="font-bold text-xs text-gray-300 tracking-wider">
                    KAYNAKLAR (SAĞLAYICILAR):
                  </p>
                  {activePbFansubLocal.sources.map((src: any, idx: number) => {
                    const isActive = selectedPbSourceId === src.id;
                    const getLabel = () => {
                      if (idx === 0) return "Ana Kaynak";
                      if (idx === 1) return "Kaynak 2";
                      if (idx === 2) return "Kaynak 3";
                      return src.label || `Kaynak ${idx + 1}`;
                    };
                    const providerImg = src.image || src.logo || src.provider_image || src.icon;
                    return (
                      <Button
                        size="sm"
                        key={src.id}
                        className={`font-bold text-xs px-3 transition-all flex items-center gap-2 ${
                          isActive
                            ? "bg-[#e9376b] text-white shadow-md ring-2 ring-[#e9376b]/40 scale-105"
                            : "bg-slate-800/80 text-gray-300 hover:bg-slate-700 hover:text-white"
                        }`}
                        onClick={() => {
                          setSelectedPbSourceId(src.id);
                          setPbPlayerUrl(src.url);
                          setPbPlayerNotice(null);
                        }}
                      >
                        {providerImg ? (
                          <img src={providerImg} alt={getLabel()} className="w-4 h-4 rounded-full object-cover" />
                        ) : null}
                        {getLabel()}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {pbFansubs.length === 0 && subProvidersForEp.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Captions className="text-red-400 h-4 w-4 shrink-0" />
              <p className="font-bold text-xs text-gray-300 tracking-wider">
                ÇEVİRİLER (FANSUBLAR):
              </p>
              {subProvidersForEp.map((pName) => {
                const isActive =
                  !isFallbackActive &&
                  currentProviderName.toLowerCase() === pName.toLowerCase() &&
                  activeCategory === "sub";

                return (
                  <Button
                    size="sm"
                    key={`sub-${pName}`}
                    className={`uppercase font-bold text-xs px-3 transition-all ${
                      isActive
                        ? "bg-[#e9376b] text-white shadow-md ring-2 ring-[#e9376b]/40 scale-105"
                        : "bg-slate-800/80 text-gray-300 hover:bg-slate-700 hover:text-white"
                    }`}
                    onClick={() => handleProviderSelect(pName, "sub")}
                  >
                    {pName}
                  </Button>
                );
              })}
            </div>
          )}

          {pbFansubs.length === 0 && dubProvidersForEp.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Mic className="text-green-400 h-4 w-4 shrink-0" />
              <p className="font-bold text-xs text-gray-300 tracking-wider">
                SESLENDİRMELER (DUBLAJ):
              </p>
              {dubProvidersForEp.map((pName) => {
                const isActive =
                  !isFallbackActive &&
                  currentProviderName.toLowerCase() === pName.toLowerCase() &&
                  activeCategory === "dub";

                return (
                  <Button
                    size="sm"
                    key={`dub-${pName}`}
                    className={`uppercase font-bold text-xs px-3 transition-all ${
                      isActive
                        ? "bg-green-600 text-white shadow-md ring-2 ring-green-500/40 scale-105"
                        : "bg-slate-800/80 text-gray-300 hover:bg-slate-700 hover:text-white"
                    }`}
                    onClick={() => handleProviderSelect(pName, "dub")}
                  >
                    {pName}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm shrink-0 self-start md:self-auto">
          {!isFallbackActive && (
            <div className="flex flex-col items-start gap-1">
              {activePbFansubLocal?.fansubRaw && (
                <p className="text-[10px] text-gray-400 leading-none">{activePbFansubLocal.fansubRaw}</p>
              )}
              <div className="flex flex-row items-center space-x-2">
                <Switch
                  checked={autoSkip}
                  onCheckedChange={(e: boolean) => onHandleAutoSkipChange(e)}
                  id="auto-skip"
                />
                <p>Otomatik Atla</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {pbPlayerNotice && (
        <Alert
          variant="destructive"
          className="border-amber-800/80 bg-amber-950/40 text-amber-200 rounded-xl"
        >
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-xs text-amber-200/80">
            {pbPlayerNotice}
          </AlertDescription>
        </Alert>
      )}

      {nextAiring && nextAiring.timeUntilAiring > 0 && (
        <Alert className="border-indigo-800/80 bg-indigo-950/40 text-indigo-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-indigo-400" />
          <AlertDescription className="text-xs text-indigo-200/80">
            <span className="font-bold">Bölüm {nextAiring.episode} Yakında Yayınlanacak</span> — Sonraki bölümün yayınlanmasına{" "}
            {nextAiringDays > 0 ? `${nextAiringDays} gün ` : ""}
            {nextAiringHours} saat kaldı.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default VideoPlayerSection;
