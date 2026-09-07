import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@crawlpact/ui";
import { getGoogleAccountsId, loadGoogleIdentityServices } from "../../lib/google-identity";

type GoogleStatus = { connected: boolean; email: string | null; connectedAt: string | null };

const GOOGLE_ERROR_COPY: Record<string, string> = {
  google_already_linked: "This Google account is already connected to another CrawlPact account.",
  google_admin_passkey_required: "Administrator accounts cannot connect Google sign-in.",
  google_invalid_request: "Connecting Google could not be completed. Please try again.",
};

/**
 * "Sign-in methods" → Google, in Account settings (section 21). Mirrors
 * PasskeysManager.tsx's fetch-on-mount pattern. Disconnecting is refused
 * server-side (AUTH_GOOGLE_DISCONNECT_BLOCKED) whenever it would leave the
 * account with no usable sign-in method — this panel just surfaces
 * whatever message the API returns, the same way every other sensitive
 * action panel here does (RecoveryCodesPanel, PasskeysManager).
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
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  async function refresh() {
    const response = await fetch("/api/account/google");
    const body = (await response.json()) as { ok: boolean; data?: GoogleStatus };
    if (body.ok && body.data) setStatus(body.data);
  }

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("googleLinked") === "1") setInfo("Google account connected.");
    const code = params.get("googleError");
    if (code) setError(GOOGLE_ERROR_COPY[code] ?? GOOGLE_ERROR_COPY["google_invalid_request"]!);
  }, []);

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
        login_uri: `${window.location.origin}/api/auth/google`,
        nonce: linkBegin.nonce,
        ux_mode: "redirect",
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
          {!googleUnavailable && <div ref={buttonRef} aria-live="polite" />}
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
