"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import {
  flushAnalyticsEvents,
  GA_MEASUREMENT_ID,
  trackEvent,
} from "@/lib/analytics";

function PageAnalytics({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPageRef = useRef("");
  const search = searchParams.toString();

  const reportWebVital = useCallback<Parameters<typeof useReportWebVitals>[0]>(
    (metric) => {
      trackEvent("web_vital", {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_rating: metric.rating,
        metric_id: metric.id,
        navigation_type: metric.navigationType,
      });
    },
    [],
  );
  useReportWebVitals(reportWebVital);

  useEffect(() => {
    if (!ready || !pathname) return;
    const pageParams = new URLSearchParams(search);
    if (pathname === "/search") pageParams.delete("q");
    const safeSearch = pageParams.toString();
    const pagePath = safeSearch ? `${pathname}?${safeSearch}` : pathname;
    if (lastPageRef.current === pagePath) return;
    lastPageRef.current = pagePath;

    trackEvent("page_view", {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title,
    });
  }, [pathname, search, ready]);

  return null;
}

export default function GoogleAnalytics() {
  const [ready, setReady] = useState(false);
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        onReady={() => {
          flushAnalyticsEvents();
          setReady(true);
        }}
      >
        {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', ${JSON.stringify(GA_MEASUREMENT_ID)}, { send_page_view: false });`}
      </Script>
      <Suspense fallback={null}>
        <PageAnalytics ready={ready} />
      </Suspense>
    </>
  );
}