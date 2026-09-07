/**
 * Minimal client-side wrapper around Google Identity Services' "Sign In
 * With Google" JS SDK (ADR-0009, corrected transport). Only the fields this
 * app actually uses are typed — see
 * https://developers.google.com/identity/gsi/web/reference/js-reference
 * for the full surface. Deliberately narrow rather than pulling in a
 * third-party type package for one script.
 */

export type GoogleCredentialResponse = {
  /** The Google ID token — never logged, never placed in a URL, forwarded only to /api/auth/google. */
  credential: string;
  select_by?: string;
  /** The `state` the clicked button was rendered with (`GoogleButtonConfiguration.state`) — CrawlPact's own opaque OAuth-intent identifier, not anything Google interprets. */
  state?: string;
};

export type GoogleIdConfiguration = {
  client_id: string;
  /** JavaScript-callback mode (ADR-0009's transport correction) — GIS invokes this in-browser after the user picks an account; it never posts to CrawlPact directly. */
  callback: (response: GoogleCredentialResponse) => void;
  /** Shared across every button rendered on this page load (section 13/31) — verified server-side against the OAuth intent it was issued for. */
  nonce: string;
  ux_mode: "popup";
  /** Never enabled — explicit user intent only (section 31: "No One Tap. No automatic prompt."). */
  auto_select?: false;
  itp_support?: boolean;
};

export type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  /** The only per-button differentiator (renderButton, not initialize) — returned verbatim as `state` on the CredentialResponse, so the callback can tell which button was actually clicked. */
  state?: string;
};

type GoogleAccountsId = {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads https://accounts.google.com/gsi/client at most once per page, however many times this is called. */
export function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services requires a browser environment."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a later retry (e.g. after a transient network failure)
      reject(new Error("Google Identity Services failed to load."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function getGoogleAccountsId(): GoogleAccountsId | null {
  return window.google?.accounts.id ?? null;
}
