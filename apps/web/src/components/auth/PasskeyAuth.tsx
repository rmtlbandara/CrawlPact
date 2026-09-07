import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { Alert, Button, FormField, Input } from "@crawlpact/ui";
import { track } from "../../lib/analytics-client";
import { getGoogleAccountsId, loadGoogleIdentityServices } from "../../lib/google-identity";

type Mode = "signin" | "signup" | "recovery";

type Screen =
  | { step: "form" }
  | { step: "recovery-codes"; codes: string[] }
  | { step: "error"; message: string };

/** Section 34 — a small, stable vocabulary of Google failure codes, never raw JWT/DB errors. */
const GOOGLE_ERROR_COPY: Record<string, string> = {
  google_not_linked:
    "No CrawlPact account is connected to that Google account. Choose Create account to make a new account, or sign in with your existing passkey and connect Google from Account settings.",
  google_already_linked: "This Google account is already connected to another CrawlPact account.",
  google_account_unavailable: "This account is not available.",
  google_admin_passkey_required: "Administrator accounts must sign in with a passkey.",
  google_invalid_request:
    "Google sign-in could not be completed. Please try again, or use a passkey.",
};

function googleErrorFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("googleError");
  if (!code) return null;
  return GOOGLE_ERROR_COPY[code] ?? GOOGLE_ERROR_COPY["google_invalid_request"]!;
}

/**
 * Passkey and Google sign-in/sign-up (SRS §24, ADR-0009). No password, no
 * email/password field anywhere — "Create account" and "Sign in" are each
 * either a single WebAuthn ceremony round-trip through
 * /api/auth/{register,login}/{begin,finish}, or Google's official "Sign In
 * With Google" button via the GIS redirect flow through
 * /api/auth/google/{begin,''}. Recovery-code redemption is the only other
 * path in, for when no passkey is available. A Google SDK/network failure
 * never breaks passkey sign-in — see the `googleUnavailable` handling below.
 */
export function PasskeyAuth({
  redirectTo = "/app",
  initialMode = "signin",
  googleClientId,
}: {
  redirectTo?: string;
  /** Phase 5: defaults the visible tab to "signup" when arriving from a
   * "Save and monitor" CTA (the common case — most clickers are new users),
   * without changing default behaviour for every other existing caller. */
  initialMode?: Mode;
  /** Public Google OAuth Web Client ID — not a secret (packages/config's env schema requires it). */
  googleClientId: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>(() => {
    const googleError = googleErrorFromLocation();
    return googleError ? { step: "error", message: googleError } : { step: "form" };
  });
  const nameInputId = useId();
  const codeInputId = useId();

  const [googleBegin, setGoogleBegin] = useState<{
    nonce: string;
    signInState: string;
    signUpState: string;
  } | null>(null);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const signInButtonRef = useRef<HTMLDivElement | null>(null);
  const signUpButtonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  // Begin the Google OAuth intents and load the GIS script exactly once per
  // page load, regardless of how many times the visible tab changes
  // (section 31: "Initialize GIS only once per page"). Either failing
  // (network, the endpoint down, the script blocked by privacy tooling)
  // only disables the Google UI — passkey/recovery sign-in stay fully
  // functional (section 32).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/google/begin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            redirectTo,
            failureRedirect: window.location.pathname + window.location.search,
          }),
        });
        const parsed = (await response.json()) as {
          ok: boolean;
          data?: { nonce: string; signInState: string; signUpState: string };
        };
        if (!cancelled && parsed.ok && parsed.data) setGoogleBegin(parsed.data);
        else if (!cancelled) setGoogleUnavailable(true);
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
    // Intentionally empty deps — runs once; `redirectTo` is stable for the lifetime of this page.
  }, []);

  // Renders the Google button for whichever tab is currently visible.
  // `initialize()` genuinely only needs to run once (client_id/login_uri/
  // nonce never change); `renderButton()` re-runs whenever the active mode
  // or the target container changes, per section 31's "rerender the button
  // when the tab changes" guidance.
  useEffect(() => {
    if (!googleReady || !googleBegin || googleUnavailable) return;
    const accountsId = getGoogleAccountsId();
    if (!accountsId) return;

    if (!initializedRef.current) {
      accountsId.initialize({
        client_id: googleClientId,
        login_uri: `${window.location.origin}/api/auth/google`,
        nonce: googleBegin.nonce,
        ux_mode: "redirect",
        auto_select: false,
      });
      initializedRef.current = true;
    }

    if (mode === "signin" && signInButtonRef.current) {
      signInButtonRef.current.innerHTML = "";
      accountsId.renderButton(signInButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 336,
        state: googleBegin.signInState,
      });
    } else if (mode === "signup" && signUpButtonRef.current) {
      signUpButtonRef.current.innerHTML = "";
      accountsId.renderButton(signUpButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signup_with",
        width: 336,
        state: googleBegin.signUpState,
      });
    }
  }, [googleReady, googleBegin, googleUnavailable, mode, googleClientId]);

  function friendlyWebAuthnError(error: unknown): string {
    if (error instanceof WebAuthnError) {
      if (error.name === "NotAllowedError") {
        return "The passkey prompt was cancelled or timed out. Please try again.";
      }
      if (error.name === "InvalidStateError") {
        return "This device already has a passkey for this account.";
      }
      return "Your browser or device could not complete the passkey ceremony.";
    }
    return "Something went wrong. Please try again.";
  }

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = (await response.json()) as {
      ok: boolean;
      data?: T;
      error?: { message: string };
    };
    if (!parsed.ok) throw new Error(parsed.error?.message ?? "Request failed.");
    return parsed.data as T;
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const begin = await postJson<{
        challengeId: string;
        publicKeyCredentialCreationOptions: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/api/auth/register/begin", { displayName });

      const credential = await startRegistration({
        optionsJSON: begin.publicKeyCredentialCreationOptions,
      });

      const finished = await postJson<{ recoveryCodes: string[] }>("/api/auth/register/finish", {
        challengeId: begin.challengeId,
        credential,
      });

      setScreen({ step: "recovery-codes", codes: finished.recoveryCodes });
    } catch (error) {
      setScreen({
        step: "error",
        message:
          error instanceof WebAuthnError ? friendlyWebAuthnError(error) : (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const begin = await postJson<{
        challengeId: string;
        publicKeyCredentialRequestOptions: Parameters<typeof startAuthentication>[0]["optionsJSON"];
      }>("/api/auth/login/begin", {});

      const credential = await startAuthentication({
        optionsJSON: begin.publicKeyCredentialRequestOptions,
      });

      await postJson("/api/auth/login/finish", { challengeId: begin.challengeId, credential });
      window.location.href = redirectTo;
    } catch (error) {
      setScreen({
        step: "error",
        message:
          error instanceof WebAuthnError ? friendlyWebAuthnError(error) : (error as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoveryRedeem(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await postJson("/api/auth/recovery-codes/redeem", { code: recoveryCode });
      window.location.href = redirectTo;
    } catch (error) {
      setScreen({ step: "error", message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (screen.step === "recovery-codes") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title="Save your recovery codes now">
          These codes are shown once. Without a passkey and without these codes, CrawlPact cannot
          recover your account — there is no email or password reset.
        </Alert>
        <pre className="overflow-x-auto rounded-card border border-neutral-300 bg-neutral-50 p-4 text-body font-mono">
          {screen.codes.join("\n")}
        </pre>
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadRecoveryCodes(screen.codes)}
        >
          Download codes
        </Button>
        <label className="flex items-start gap-2 text-body text-neutral-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmedSaved}
            onChange={(event) => setConfirmedSaved(event.target.checked)}
          />
          I have saved these recovery codes somewhere safe.
        </label>
        <Button
          type="button"
          disabled={!confirmedSaved}
          onClick={() => (window.location.href = redirectTo)}
        >
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 border-b border-neutral-200">
        {(["signin", "signup", "recovery"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMode(tab);
              setScreen({ step: "form" });
              if (tab === "signup") track("account_started");
            }}
            className={
              "px-3 py-2 text-body font-medium " +
              (mode === tab
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-neutral-600 hover:text-neutral-900")
            }
            aria-current={mode === tab || undefined}
          >
            {tab === "signin" ? "Sign in" : tab === "signup" ? "Create account" : "Recovery code"}
          </button>
        ))}
      </div>

      {screen.step === "error" && (
        <Alert tone="error" title="That didn't work">
          {screen.message}
        </Alert>
      )}

      {mode === "signin" && (
        <div className="flex flex-col gap-4">
          {!googleUnavailable && (
            <div className="flex flex-col items-center gap-3">
              <div ref={signInButtonRef} aria-live="polite" />
              <div className="flex w-full items-center gap-3 text-supporting text-neutral-500">
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
                or
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
              </div>
            </div>
          )}
          {googleUnavailable && (
            <p className="text-supporting text-neutral-600">
              Google sign-in is currently unavailable. You can still sign in with a passkey.
            </p>
          )}
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <p className="text-body text-neutral-700">
              Sign in with the passkey registered to your device — no username needed.
            </p>
            <Button type="submit" isLoading={busy}>
              Sign in with passkey
            </Button>
          </form>
        </div>
      )}

      {mode === "signup" && (
        <div className="flex flex-col gap-4">
          {!googleUnavailable && (
            <div className="flex flex-col items-center gap-3">
              <div ref={signUpButtonRef} aria-live="polite" />
              <div className="flex w-full items-center gap-3 text-supporting text-neutral-500">
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
                or
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
              </div>
            </div>
          )}
          {googleUnavailable && (
            <p className="text-supporting text-neutral-600">
              Google sign-up is currently unavailable. You can still create an account with a
              passkey.
            </p>
          )}
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <FormField label="Display name">
              <Input
                id={nameInputId}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                required
                maxLength={80}
              />
            </FormField>
            <Button type="submit" isLoading={busy} disabled={displayName.trim().length === 0}>
              Create account with a passkey
            </Button>
          </form>
        </div>
      )}

      {mode === "recovery" && (
        <form onSubmit={handleRecoveryRedeem} className="flex flex-col gap-4">
          <FormField
            label="Recovery code"
            description="Enter one of the one-time codes you saved at sign-up."
          >
            <Input
              id={codeInputId}
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              autoComplete="off"
              required
            />
          </FormField>
          <Button type="submit" isLoading={busy} disabled={recoveryCode.trim().length === 0}>
            Sign in with recovery code
          </Button>
        </form>
      )}
    </div>
  );
}

function downloadRecoveryCodes(codes: string[]): void {
  const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "crawlpact-recovery-codes.txt";
  link.click();
  URL.revokeObjectURL(url);
}
