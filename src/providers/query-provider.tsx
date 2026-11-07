"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { migrateLegacyLocalWatchHistory } from "@/lib/local-watch-history";

type Props = {
  children: ReactNode;
};

const QueryProvider = (props: Props) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!localStorage.getItem("kitsune_v3_migrated")) {
        console.log("Migration: Clearing legacy local storage watched records.");
        // Keep existing guest progress by moving it to the new local format.
        migrateLegacyLocalWatchHistory();
        localStorage.removeItem("watched");
        localStorage.removeItem("serverPreference");
        localStorage.setItem("kitsune_v3_migrated", "true");
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  );
};

export default QueryProvider;

