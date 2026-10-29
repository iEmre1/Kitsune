"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Next.js'e bu sayfanın dinamik (URL parametresi alan) bir sayfa olduğunu açıkça belirtiyoruz
export const dynamic = "force-dynamic";

function VerificationHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        return;
      }

      try {
        // PocketBase üzerinde doğrulamayı tetikliyoruz
        await pb.collection("users").confirmVerification(token);
        setStatus("success");
        toast.success("E-posta adresiniz doğrulandı!");

        // 3 saniye sonra kullanıcıyı ana sayfaya yönlendir
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        toast.error("Doğrulama linki geçersiz veya süresi dolmuş.");
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in-95 duration-200">
      {status === "loading" && (
        <>
          <Loader2 className="h-12 w-12 text-pink-500 animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            Hesabınız Onaylanıyor
          </h2>
          <p className="text-sm text-gray-400">
            Lütfen bekleyin, e-posta adresiniz doğrulanıyor...
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            Doğrulama Başarılı!
          </h2>
          <p className="text-sm text-gray-400">
            E-posta adresiniz onaylandı. Giriş yapmaya hazırsınız. Ana sayfaya
            yönlendiriliyorsunuz...
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-200 mb-2">
            Onay Başarısız
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Bu doğrulama linki geçersiz, süresi dolmuş veya daha önce
            kullanılmış olabilir.
          </p>
          <Link href="/" className="text-xs text-pink-500 hover:underline">
            Ana Sayfaya Dön
          </Link>
        </>
      )}
    </div>
  );
}

export default function ConfirmVerificationPage() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950">
      <Suspense
        fallback={
          <div className="text-center text-gray-400">
            <Loader2 className="h-8 w-8 text-pink-500 animate-spin mx-auto mb-2" />
            Yükleniyor...
          </div>
        }
      >
        <VerificationHandler />
      </Suspense>
    </div>
  );
}
