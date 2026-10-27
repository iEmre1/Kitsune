"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "./custom-button";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

const ErrorState = ({
  title = "Veriler yüklenemedi",
  description = "AniList servisine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
  onRetry,
  className,
}: Props) => {
  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-800/60 bg-secondary/30 px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-7 w-7 text-[#e9376b]" />
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="max-w-md text-sm text-gray-400">{description}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="mt-2 rounded-full bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
          LeftIcon={RefreshCw}
        >
          Tekrar Dene
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
