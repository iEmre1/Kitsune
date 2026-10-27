export type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "";

const pendingEvents: Array<{ name: string; params: AnalyticsParams }> = [];

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  );

  if (typeof window === "undefined") return;
  if (!window.gtag) {
    if (pendingEvents.length < 100) {
      pendingEvents.push({ name: eventName, params: cleanParams });
    }
    return;
  }

  window.gtag("event", eventName, cleanParams);
}

export function flushAnalyticsEvents() {
  if (typeof window === "undefined" || !window.gtag) return;

  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    if (event) window.gtag("event", event.name, event.params);
  }
}