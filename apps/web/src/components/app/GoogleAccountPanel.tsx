import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@crawlpact/ui";
import {
  getGoogleAccountsId,
  loadGoogleIdentityServices,
  type GoogleCredentialResponse,
} from "../../lib/google-identity";

type GoogleStatus = { connected: boolean; email: string | null; connectedAt: string | null };

const GOOGLE_ERROR_COPY: Record<string, string> = {
  AUTH_GOOGLE_ALREADY_LINKED:
    "This Google account is already connected to another CrawlPact account.",
  AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY: "Administrator accounts cannot connect Google sign-in.",
  AUTH_GOOGLE_INVALID_REQUEST: "Connecting Google could not be completed. Please try again.",
};

function googleFriendlyMessage(code: string | undefined, fallback: string): string {
  return GOOGLE_ERROR_COPY[code ?? ""] ?? fallback;
}

/**
 * "Sign-in methods" → Google, in Account settings (section 21). Mirrors
 * PasskeysManager.tsx's fetch-on-mount pattern. GIS runs in JavaScript-
 * callback mode (ADR-0009's corrected transport) — Google hands the
 * CredentialResponse to this page in-browser, which then forwards it as a
 * same-origin JSON POST to /api/auth/google, `credentials: "same-origin"`
 * so the existing link session cookie travels with it. Disconnecting is
 * refused server-side (AUTH_GOOGLE_DISCONNECT_BLOCKED) whenever it would
 * leave the account with no usable sign-in method — this panel just
 * surfaces whatever message the API returns, the same way every other
 * sensitive action panel here does (RecoveryCodesPanel, PasskeysManager).
 */
export function GoogleAccountPanel({
  googleClientId,
  isAdmin,
}: {
  googleClientId: string;
  /** Administrator accounts can never authenticate via Google (section 29) — the "Connect Google" flow is hidden rather than offered and then always rejected server-side. */
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [linkBegin, setLinkBegin] = useState<{ nonce: string; state: string } | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [linking, setLinking] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const linkSubmittingRef = useRef(false);

  async function refresh() {
    const response = await fetch("/api/account/google");
    const body = (await response.json()) as { ok: boolean; data?: GoogleStatus };
    if (body.ok && body.data) setStatus(body.data);
  }

  useEffect(() => {
    void refresh();
  }, []);

  /**
   * GIS's JavaScript-callback contract — invoked in-browser once the user
   * picks a Google account to connect. `credentials: "same-origin"` is
   * load-bearing here: the server must see this page's existing CrawlPact
   * session cookie to verify the link request belongs to the account that
   * started it (section 36).
   */
  async function handleGoogleCredentialResponse(response: GoogleCredentialResponse): Promise<void> {
    if (linkSubmittingRef.current) return;
    if (!response?.credential || !response?.state) {
      setError(googleFriendlyMessage(undefined, GOOGLE_ERROR_COPY.AUTH_GOOGLE_INVALID_REQUEST!));
      return;
    }
    linkSubmittingRef.current = true;
    setLinking(true);
    setError(null);
    setInfo(null);
    try {
      const apiResponse = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ credential: response.credential, state: response.state }),
      });
      const parsed = (await apiResponse.json()) as {
        ok: boolean;
        data?: { redirectTo: string };
        error?: { code?: string; message: string };
      };
      if (parsed.ok) {
        setInfo("Google account connected.");
        await refresh();
        return;
      }
      setError(
        googleFriendlyMessage(
          parsed.error?.code,
          parsed.error?.message ?? GOOGLE_ERROR_COPY.AUTH_GOOGLE_INVALID_REQUEST!,
        ),
      );
    } catch {
      setError(GOOGLE_ERROR_COPY.AUTH_GOOGLE_INVALID_REQUEST!);
    } finally {
      linkSubmittingRef.current = false;
      setLinking(false);
    }
  }

  // Once we know the account has no Google identity connected yet, begin a
  // link intent and load GIS so the official "Connect Google" button can be
  // rendered — same pattern as PasskeyAuth.tsx's sign-in/sign-up buttons.
  useEffect(() => {
    if (isAdmin || !status || status.connected) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/account/google/link/begin", { method: "POST" });
        const body = (await response.json()) as {
          ok: boolean;
          data?: { nonce: string; state: string };
          error?: { message: string };
        };
        if (!cancelled && body.ok && body.data) setLinkBegin(body.data);
        else if (!cancelled) {
          setGoogleUnavailable(true);
          if (body.error?.message) setError(body.error.message);
        }
      } catch {
        if (!cancelled) setGoogleUnavailable(true);
      }
      try {
        await loadGoogleIdentityServices();
        if (!cancelled) setGoogleReady(true);
      } catch {
        if (!cancelled) setGoogleUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!googleReady || !linkBegin || googleUnavailable || !buttonRef.current) return;
    const accountsId = getGoogleAccountsId();
    if (!accountsId) return;

    if (!initializedRef.current) {
      accountsId.initialize({
        client_id: googleClientId,
        callback: (response) => void handleGoogleCredentialResponse(response),
        nonce: linkBegin.nonce,
        ux_mode: "popup",
        auto_select: false,
      });
      initializedRef.current = true;
    }
    buttonRef.current.innerHTML = "";
    accountsId.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      width: 240,
      state: linkBegin.state,
    });
  }, [googleReady, linkBegin, googleUnavailable, googleClientId]);

  async function handleDisconnect() {
    setError(null);
    setInfo(null);
    setDisconnecting(true);
    try {
      const response = await fetch("/api/account/google/disconnect", { method: "POST" });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Could not disconnect Google.");
        return;
      }
      setInfo("Google disconnected.");
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (isAdmin) {
    return (
      <p className="text-body text-neutral-700">
        Administrator accounts sign in with a passkey only — Google sign-in is not available for
        this account.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-neutral-700">
        Connect your Google account for another way to sign in. CrawlPact never sees your Google
        password and never requests access to your Gmail, Drive, or other Google data.
      </p>

      {error && (
        <Alert tone="error" title="That didn't work">
          {error}
        </Alert>
      )}
      {info && <Alert tone="success" title={info} />}

      {status === null ? null : status.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-neutral-200 bg-white px-4 py-3">
          <div>
            <p className="text-body font-medium text-neutral-900">Google — connected</p>
            {status.email && <p className="text-supporting text-neutral-600">{status.email}</p>}
          </div>
          <Button
            variant="secondary"
            isLoading={disconnecting}
            onClick={() => void handleDisconnect()}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {!googleUnavailable && <div ref={buttonRef} aria-live="polite" aria-busy={linking} />}
          {googleUnavailable && (
            <p className="text-supporting text-neutral-600">
              Connecting Google is currently unavailable. Please try again later.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
