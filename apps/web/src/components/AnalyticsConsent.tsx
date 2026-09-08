import { useEffect, useState } from "react";
import { Button } from "@crawlpact/ui";
import {
  ANALYTICS_CONSENT_COOKIE,
  encodeConsentCookieValue,
  parseConsentCookieValue,
  type AnalyticsConsentState,
} from "../lib/consent";

type Props = {
  /** Computed server-side (apps/web/src/lib/consent.ts's isGaEligibleRoute)
   * for the exact page this island is mounted on. */
  gaEligible: boolean;
  /** The real consent cookie, read server-side from this same request
   * (MarketingLayout.astro's `Astro.cookies`). Without this, the component
   * has no way to know the visitor's decision until its own `useEffect` runs
   * post-hydration — client:load still SSRs with a hardcoded default, so a
   * fresh visitor's first paint always showed no banner, then the banner
   * flashed in ~2-3s later once JS loaded/hydrated/ran the effect. That
   * delayed reveal was large enough, on pages with sparse above-the-fold
   * content (e.g. /sample-report), to make the banner text itself the
   * LCP element — a real, measurable regression once Lighthouse's
   * `--throttling-method=devtools` (real network replay) replaced its
   * default Lantern-simulated timing, which had been masking it. Passing
   * the true state through means the very first server-rendered paint
   * (and the client's initial hydration, since Astro islands hydrate from
   * their serialized server props, not a fresh client computation) already
   * reflects reality — no flash, no delayed reveal. */
  initialConsentState: AnalyticsConsentState | null;
};

function readConsentCookie(): AnalyticsConsentState | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ANALYTICS_CONSENT_COOKIE}=([^;]*)`));
  return parseConsentCookieValue(match?.[1] ? decodeURIComponent(match[1]) : null);
}

function writeConsentCookie(state: AnalyticsConsentState) {
  const isLocal = window.location.hostname === "localhost";
  const maxAgeSeconds = 60 * 60 * 24 * 182; // ~6 months, see CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md
  const parts = [
    `${ANALYTICS_CONSENT_COOKIE}=${encodeURIComponent(encodeConsentCookieValue(state))}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (!isLocal) parts.push("Secure");
  document.cookie = parts.join("; ");
}

/** Best-effort: GA's own `_ga`/`_ga_*` cookies are set by gtag.js on this
 * domain, so a Max-Age=0 write for the same name/path clears them. This
 * cannot reach cookies on other domains, and cannot delete data Google has
 * already received — see docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md
 * "Consent revocation" for what this can and cannot guarantee. */
function clearGaCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter((name): name is string => typeof name === "string" && name.startsWith("_ga"));
  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/**
 * Phase 22 addendum: Microsoft Clarity's project snippet, copied verbatim
 * (see MicrosoftClarity.astro's doc comment) — this is the client-side
 * equivalent of that same server-rendered component, needed because a
 * first-time visitor who clicks "Accept" during the current page view has no
 * consent cookie yet on this request, so the SSR component never rendered;
 * without this, Clarity would only start on that visitor's *next* page load,
 * not the one where they actually granted consent. Guarded by checking for
 * `window.clarity` first, matching `loadGoogleAnalytics()`'s own
 * already-injected guard.
 */
type ClarityQueue = { (...args: unknown[]): void; q?: unknown[] };

function loadMicrosoftClarity() {
  const w = window as unknown as { clarity?: ClarityQueue };
  if (typeof w.clarity !== "undefined") return;

  const queue: ClarityQueue = (...args: unknown[]) => {
    queue.q = queue.q || [];
    queue.q.push(args);
  };
  w.clarity = queue;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.clarity.ms/tag/yf18yfb8m9";
  const existingScript = document.getElementsByTagName("script")[0];
  if (existingScript?.parentNode) {
    existingScript.parentNode.insertBefore(script, existingScript);
  } else {
    document.head.appendChild(script);
  }
}

/** Best-effort, mirroring clearGaCookies() above: Clarity's own documented
 * cookies (learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-csp)
 * are `_clck` and `_clsk`. */
function clearClarityCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter((name): name is string => name === "_clck" || name === "_clsk");
  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

function loadGoogleAnalytics() {
  if (document.getElementById("ga-gtag-script")) return;
  const loader = document.createElement("script");
  loader.id = "ga-gtag-script";
  loader.async = true;
  loader.src = "https://www.googletagmanager.com/gtag/js?id=G-1W5HP7S561";
  document.head.appendChild(loader);

  const inline = document.createElement("script");
  inline.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("js", new Date());
    gtag("config", "G-1W5HP7S561", {
      page_location: window.location.origin + window.location.pathname,
    });
  `;
  document.head.appendChild(inline);
}

/** Fires if gtag is already loaded on this page (SSR-granted case) — a
 * client-side decline still needs to tell an already-running tag to stop. */
function denyGaIfLoaded() {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", { analytics_storage: "denied" });
  }
}

/**
 * Phase 13 (RISK-021): global, first-party, non-geographic analytics
 * opt-in. Rendered once per MarketingLayout page — see
 * docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md for the full
 * design. Deliberately not a modal dialog (no focus trap, never blocks
 * access to the rest of the page — "no consent wall" is a hard requirement):
 * a persistent, dismissible `role="region"` panel instead.
 */
export function AnalyticsConsent({ gaEligible, initialConsentState }: Props) {
  const [consent, setConsent] = useState<AnalyticsConsentState | null>(initialConsentState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasDecided, setHasDecided] = useState(initialConsentState !== null);

  useEffect(() => {
    // Re-read on the client too: a cookie written in another tab, or any
    // future divergence between what the server saw and what the browser
    // now has, still self-corrects. Cheap and idempotent when they already
    // agree, which is the common case now that the initial state is real.
    const existing = readConsentCookie();
    setConsent(existing);
    setHasDecided(existing !== null);
    if (existing === "granted" && gaEligible) {
      loadGoogleAnalytics();
      loadMicrosoftClarity();
    }
  }, [gaEligible]);

  function record(
    eventName:
      "analytics_consent_granted" | "analytics_consent_declined" | "analytics_consent_changed",
  ) {
    // Best-effort, fire-and-forget aggregate counter — never blocks the
    // consent decision itself on network success. No visitor identifier is
    // sent (see PRODUCT_EVENT_REGISTRY.md).
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName }),
    }).catch(() => {});
  }

  function accept() {
    const wasDecided = hasDecided;
    writeConsentCookie("granted");
    setConsent("granted");
    setHasDecided(true);
    setPanelOpen(false);
    if (gaEligible) {
      loadGoogleAnalytics();
      loadMicrosoftClarity();
    }
    record(wasDecided ? "analytics_consent_changed" : "analytics_consent_granted");
  }

  function decline() {
    const wasDecided = hasDecided;
    writeConsentCookie("denied");
    setConsent("denied");
    setHasDecided(true);
    setPanelOpen(false);
    denyGaIfLoaded();
    clearGaCookies();
    clearClarityCookies();
    record(wasDecided ? "analytics_consent_changed" : "analytics_consent_declined");
  }

  const showPanel = !hasDecided || panelOpen;

  return (
    <>
      {!showPanel && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-3 left-3 z-40 rounded-control bg-white px-3 py-1.5 text-metadata text-neutral-600 shadow-md hover:text-brand-700"
        >
          Analytics preferences
        </button>
      )}
      {showPanel && (
        <div
          role="region"
          aria-label="Analytics preferences"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white px-4 py-4 shadow-lg sm:px-6"
        >
          <div className="mx-auto flex max-w-[1240px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-semibold text-neutral-950">Analytics preferences</p>
              <p className="mt-1 max-w-2xl text-supporting text-neutral-600">
                CrawlPact uses optional Google Analytics and Microsoft Clarity on public marketing
                pages to understand which content is useful and how visitors actually use it.
                Neither is used in the authenticated app or admin areas. You can accept or decline
                analytics without affecting the service.
              </p>
              {hasDecided && (
                <p className="mt-1 text-metadata text-neutral-500">
                  Current preference: {consent === "granted" ? "Accepted" : "Declined"}.
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <Button variant="secondary" onClick={decline}>
                Decline analytics
              </Button>
              <Button variant="primary" onClick={accept}>
                Accept analytics
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
