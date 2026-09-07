/**
 * Minimal client-side wrapper around Google Identity Services' "Sign In
 * With Google" JS SDK (ADR-0009). Only the fields this app actually uses
 * are typed — see https://developers.google.com/identity/gsi/web/reference/js-reference
 * for the full surface. Deliberately narrow rather than pulling in a
 * third-party type package for one script.
 */

export type GoogleIdConfiguration = {
  client_id: string;
  /** Must exactly match an Authorized redirect URI configured in Google Auth Platform. */
  login_uri: string;
  /** Shared across every button rendered on this page load (section 13/31) — verified server-side against the OAuth intent it was issued for. */
  nonce: string;
  ux_mode: "redirect";
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
  /** The only per-button differentiator (renderButton, not initialize) — returned verbatim as `state` in the /api/auth/google callback POST, so the server can tell which button was actually clicked. */
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
