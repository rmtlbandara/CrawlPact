import type { Page } from "@playwright/test";

/**
 * Registers a real Chromium DevTools Protocol virtual authenticator on the
 * given page's browser context. Unlike the fabricated request/response
 * objects `tests/integration/virtual-authenticator.ts` builds for
 * integration tests (which never touch a browser), this makes the actual
 * page's `navigator.credentials.create()`/`.get()` calls succeed for real —
 * the full client-side WebAuthn ceremony runs exactly as it would for a real
 * user with a real security key, just backed by CDP's software
 * authenticator instead of hardware.
 */
export async function addVirtualAuthenticator(page: Page): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return async () => {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach().catch(() => undefined);
  };
}
