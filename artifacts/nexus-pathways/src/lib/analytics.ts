type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    // Replit injects Umami into published website artifacts when analytics is enabled.
    // Development and unpublished environments intentionally remain safe no-ops.
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt a user workflow.
  }
}