import type { APIRoute } from "astro";
import { TRUST_CONFIG } from "../../lib/trust-config";

export const prerender = true;

/**
 * RFC 9116 security.txt. Generated from `TRUST_CONFIG` so the contact address and expiry can
 * never silently drift from the rest of the trust surface. `Expires` is a fixed value set at the
 * last substantive security-policy review (`TRUST_CONFIG.securityTxtExpiry`), not calculated
 * per-request — see docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md for the review cadence.
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL("https://crawlpact.com");
  const body = [
    `Contact: mailto:${TRUST_CONFIG.securityContact}`,
    `Canonical: ${new URL(TRUST_CONFIG.routes.securityTxt, base).toString()}`,
    `Policy: ${new URL(TRUST_CONFIG.routes.security, base).toString()}`,
    `Preferred-Languages: en`,
    `Expires: ${TRUST_CONFIG.securityTxtExpiry}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
