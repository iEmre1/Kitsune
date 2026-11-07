"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { pb } from "@/lib/pocketbase";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import Container from "@/components/container";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type Status = "form" | "success" | "invalid";

function ResetHandler() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;

    if (password.length < 8) {
      setError("Şifre çok kısa. En az 8 karakter olmalı.");
      return;
    }
    if (password !== passwordConfirm) {
      setError(
        "Şifreler birbiriyle eşleşmiyor. İki alana aynı şifreyi girdiğinizden emin olun."
      );
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await pb
        .collection("users")
        .confirmPasswordReset(token, password, passwordConfirm);
      setStatus("success");
    } catch (err: any) {
      console.error("Password reset error:", err);
      const data = err?.response?.data;

      if (err?.status === 0) {
        setError(
          "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."
        );
      } else if (data?.token) {
        setStatus("invalid");
      } else if (data?.password) {
        setError("Bu şifre kabul edilmedi. En az 8 karakterlik bir şifre seçin.");
      } else if (data?.passwordConfirm) {
        setError("Şifreler birbiriyle eşleşmiyor.");
      } else {
        setError("Şifre değiştirilemedi. Lütfen biraz sonra tekrar deneyin.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <Container className="max-w-sm w-full mx-auto px-4">
        <div className="flex flex-col items-center text-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            Şifreniz değiştirildi
          </h1>
          <p className="text-sm text-muted-foreground">
            Yeni şifrenizle giriş yapabilirsiniz.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ana sayfaya git
          </Link>
        </div>
      </Container>
    );
  }

  if (status === "invalid") {
    return (
      <Container className="max-w-sm w-full mx-auto px-4">
        <div className="flex flex-col items-center text-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">
            Bağlantı geçersiz
          </h1>
          <p className="text-sm text-muted-foreground">
            Bu şifre sıfırlama bağlantısı geçersiz, süresi dolmuş veya daha önce
            kullanılmış olabilir. Giriş penceresinden &quot;Şifremi
            unuttum&quot; diyerek yeni bir bağlantı isteyebilirsiniz.
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ana sayfaya git
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="max-w-sm w-full mx-auto px-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Yeni şifre belirleyin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hesabınız için en az 8 karakterlik yeni bir şifre girin.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Yeni şifre</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni şifrenizi girin"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Şifre tekrarı</p>
            <Input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Yeni şifrenizi tekrar girin"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Şifreyi değiştir
        </button>
      </form>
    </Container>
  );
}

export default function ConfirmPasswordResetPage() {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background">
      <Suspense
        fallback={<Loader2 className="h-8 w-8 text-primary animate-spin" />}
      >
        <ResetHandler />
      </Suspense>
    </div>
  );
}