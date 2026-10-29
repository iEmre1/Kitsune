"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Container from "@/components/container";

export const dynamic = "force-dynamic";

function VerificationHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        return;
      }

      try {
        await pb.collection("users").confirmVerification(token);
        setStatus("success");
        toast.success("E-posta adresiniz doğrulandı!");
        
        // 3 saniye sonra yumuşakça ana sayfaya yönlendir
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        toast.error("Doğrulama linki geçersiz.");
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <Container className="max-w-md w-full mx-auto px-4 flex flex-col items-center justify-center text-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 text-pink-600 animate-spin" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">Hesabınız onaylanıyor</h2>
            <p className="text-sm text-gray-400 max-w-xs">
              Lütfen bekleyin, e-posta adresiniz PocketBase altyapısı üzerinden doğrulanıyor.
            </p>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500 animate-bounce">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-emerald-400">
              Doğrulama başarılı!
            </h2>
            <p className="text-sm text-gray-400 max-w-xs">
              E-posta adresiniz başarıyla onaylandı. Reklamsız anime deneyimine hazırsınız. Ana sayfaya aktarılıyorsunuz...
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-red-400">
              Onay başarısız
            </h2>
            <p className="text-sm text-gray-400 max-w-sm">
              Bu doğrulama bağlantısı geçersiz, süresi dolmuş veya daha önce kullanılmış olabilir.
            </p>
          </div>
          <Link 
            href="/" 
            className="mt-2 px-5 py-2 text-sm font-medium bg-slate-900 border border-white/10 rounded-lg hover:bg-slate-800 text-gray-300 transition-colors"
          >
            Ana sayfaya dön
          </Link>
        </div>
      )}
    </Container>
  );
}

export default function ConfirmVerificationPage() {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#121212]">
      <Suspense
        fallback={
          <div className="text-center text-gray-400 flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-pink-600 animate-spin" />
            <span className="text-xs">Sayfa hazırlanıyor...</span>
          </div>
        }
      >
        <VerificationHandler />
      </Suspense>
    </div>
  );
}