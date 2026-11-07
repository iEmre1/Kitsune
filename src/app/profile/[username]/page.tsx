"use client";

import React, { useRef, useState } from "react";
import Container from "@/components/container";
import Avatar from "@/components/common/avatar";
import { useAuthStore } from "@/store/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useParams } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { toast } from "sonner";
import Image from "next/image";
import CoverImage from "@/assets/cover.png";
import AnimeLists from "./components/anime-lists";
import ActivityProgression from "./components/activity-progression";
import Loading from "@/app/loading";
import AnilistImport from "./components/anilist-import";
import { useQuery } from "@tanstack/react-query";
import { Camera, ImagePlus, UserX } from "lucide-react";
import { prepareProfileImage } from "@/lib/profile-image";

export type TargetProfileUser = {
  id: string;
  username: string;
  avatar: string;
  background?: string;
  collectionId: string;
  collectionName: string;
  created: string;
};

function ProfilePage() {
  const params = useParams();
  const rawUsername = params?.username as string;
  const username = rawUsername ? decodeURIComponent(rawUsername) : "";

  const { auth, setAuth } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  // Fetch target user profile by username
  const {
    data: targetUser,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["PUBLIC_PROFILE_USER", username],
    queryFn: async (): Promise<TargetProfileUser> => {
      const record = await pb
        .collection("users")
        .getFirstListItem(`username = "${username}"`, {
          requestKey: null,
        });

      return {
        id: record.id,
        username: record.username,
        avatar: record.avatar,
        background: record.background,
        collectionId: record.collectionId,
        collectionName: record.collectionName,
        created: record.created,
      };
    },
    enabled: !!username,
    staleTime: 1000 * 60 * 5, // 5 mins cache
    refetchOnWindowFocus: false,
  });

  const isOwner = !!(auth?.id && targetUser?.id && auth.id === targetUser.id);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!isOwner || !auth) return;
    const file = event.target.files?.[0];
    if (file) {
      try {
        const optimizedFile = await prepareProfileImage(file, {
          maxWidth: 512,
          maxHeight: 512,
          maxBytes: 1.5 * 1024 * 1024,
          fileName: "avatar.webp",
        });
        const res = await pb.collection("users").update(auth.id, {
          avatar: optimizedFile,
        });

        if (res) {
          setAuth({ ...auth, avatar: res.avatar });
          toast.success("Avatar başarıyla güncellendi", {
            style: { background: "green" },
          });
        }
      } catch (err: any) {
        toast.error(err?.message || "Avatar güncellenemedi", {
          style: { background: "red" },
        });
      } finally {
        event.target.value = "";
      }
    }
  };

  const handleBackgroundChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!isOwner || !auth) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const optimizedFile = await prepareProfileImage(file, {
        maxWidth: 1920,
        maxHeight: 800,
        maxBytes: 4 * 1024 * 1024,
        fileName: "background.webp",
      });
      const res = await pb.collection("users").update(auth.id, {
        background: optimizedFile,
      });
      const nextBackground = res.background as string;
      setBackgroundUrl(
        nextBackground
          ? pb.files.getURL(res, nextBackground)
          : null,
      );
      setAuth({ ...auth, background: nextBackground });
      toast.success("Background başarıyla güncellendi", {
        style: { background: "green" },
      });
    } catch (err: any) {
      toast.error(err?.message || "Background güncellenemedi", {
        style: { background: "red" },
      });
    } finally {
      event.target.value = "";
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (isError || !targetUser) {
    return (
      <Container className="min-h-[70vh] mt-24 flex flex-col items-center justify-center text-center">
        <UserX className="h-16 w-16 text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Kullanıcı Bulunamadı</h2>
        <p className="text-sm text-gray-400 mb-6">
          &quot;@{username}&quot; profili mevcut değil veya kaldırılmış.
        </p>
      </Container>
    );
  }

  return (
    <>
      <div
        className={`w-full h-48 md:h-64 lg:h-72 relative overflow-hidden ${
          isOwner ? "group cursor-pointer" : ""
        }`}
        onClick={() => {
          if (isOwner) backgroundInputRef.current?.click();
        }}
      >
        <Image
          src={
            backgroundUrl ||
            (targetUser.background
              ? `${process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://localhost:8090"}/api/files/${targetUser.collectionId}/${targetUser.id}/${targetUser.background}`
              : CoverImage.src)
          }
          alt="kapak"
          fill
          className="object-cover"
          priority
          unoptimized
          placeholder="blur"
          blurDataURL={CoverImage.blurDataURL}
        />
        {isOwner && (
          <div className="absolute inset-0 z-10 flex cursor-pointer select-none flex-col items-center justify-center bg-black/60 p-2 text-center text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
            <ImagePlus className="mb-1 h-8 w-8 animate-bounce text-white drop-shadow-md" />
            <span className="text-xs font-bold tracking-wide">Background Değiştir</span>
          </div>
        )}
        {isOwner && (
          <input
            type="file"
            ref={backgroundInputRef}
            accept="image/*"
            onChange={handleBackgroundChange}
            onClick={(event) => event.stopPropagation()}
            className="hidden"
          />
        )}
      </div>

      <Container className="min-h-[70vh] mt-10 flex flex-col md:flex-row justify-around gap-8 md:gap-4">
        {/* User Sidebar Info */}
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
          <div className="relative group rounded-full overflow-hidden shrink-0">
            <Avatar
              className="w-[150px] h-[150px] cursor-pointer"
              username={targetUser.username}
              url={targetUser.avatar}
              collectionID={targetUser.collectionId}
              id={targetUser.id}
              onClick={() => {
                if (isOwner && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
            />

            {/* Owner Hover Camera & Tooltip Overlay */}
            {isOwner && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white p-2 text-center select-none"
              >
                <Camera className="h-7 w-7 text-white mb-1 drop-shadow-md animate-bounce" />
                <span className="text-xs font-bold tracking-wide">Avatarı Değiştir</span>
              </div>
            )}
          </div>

          {isOwner && (
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          )}

          <div className="flex flex-col items-center">
            <h2 className="text-xl font-bold text-white">@{targetUser.username}</h2>
            {isOwner && (
              <span className="text-[11px] font-semibold text-[#e9376b] bg-[#e9376b]/10 px-2.5 py-0.5 rounded-full border border-[#e9376b]/20 mt-1">
                Profiliniz
              </span>
            )}
          </div>
        </div>

        {/* User Activity & Lists Section */}
        <div className="w-full md:w-2/3">
          <div className="w-full">
            {isOwner && (
              <div className="float-right flex gap-2 items-center mb-2">
                <p className="text-sm text-gray-500">İçe Aktar:</p>
                <AnilistImport />
              </div>
            )}

            <Tabs defaultValue="watching" className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-5">
                <TabsTrigger value="watching">İzleniyor</TabsTrigger>
                <TabsTrigger value="plan-to-watch">Planlandı</TabsTrigger>
                <TabsTrigger value="on-hold">Beklemede</TabsTrigger>
                <TabsTrigger value="completed">Tamamlandı</TabsTrigger>
                <TabsTrigger value="dropped">Bırakıldı</TabsTrigger>
              </TabsList>

              <TabsContent value="watching" className="mt-4">
                <AnimeLists status="watching" userId={targetUser.id} />
              </TabsContent>
              <TabsContent value="plan-to-watch" className="mt-4">
                <AnimeLists status="plan to watch" userId={targetUser.id} />
              </TabsContent>
              <TabsContent value="on-hold" className="mt-4">
                <AnimeLists status="on hold" userId={targetUser.id} />
              </TabsContent>
              <TabsContent value="completed" className="mt-4">
                <AnimeLists status="completed" userId={targetUser.id} />
              </TabsContent>
              <TabsContent value="dropped" className="mt-4">
                <AnimeLists status="dropped" userId={targetUser.id} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="my-10">
            <ActivityProgression targetUser={targetUser} />
          </div>
        </div>
      </Container>
    </>
  );
}

export default ProfilePage;
