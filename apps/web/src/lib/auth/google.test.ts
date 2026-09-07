import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey, JWTPayload } from "jose";
import { createLocalJWKSet } from "jose";
import { verifyGoogleIdToken } from "./google";

/**
 * Real cryptographic JWT verification against a local, in-memory test JWKS
 * (section 49/57) — never the live Google network. `verifyGoogleIdToken`'s
 * `jwks` option is exactly the dependency-injection seam this relies on.
 */

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const KID = "test-key-1";

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey; // a second, unrelated key pair — simulates "unknown kid"
let rs384PrivateKey: CryptoKey; // a separate key pair generated for RS384 — Web Crypto bakes the hash algorithm into the key itself

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }] });

  const otherPair = await generateKeyPair("RS256");
  otherPrivateKey = otherPair.privateKey;

  const rs384Pair = await generateKeyPair("RS384");
  rs384PrivateKey = rs384Pair.privateKey;
});

function baseClaims(overrides: Partial<JWTPayload & { nonce?: string; azp?: string }> = {}) {
  return {
    sub: "1234567890",
    email: "person@example.com",
    email_verified: true,
    name: "Ada Lovelace",
    nonce: "test-nonce-value",
    ...overrides,
  };
}

async function signToken(
  claims: Record<string, unknown>,
  options: {
    // Named `signer`, not `key`/`signingKey` — a property name containing
    // "key" paired with a `PrivateKey`-suffixed value reliably (and
    // wrongly) trips gitleaks' generic-api-key heuristic, even though the
    // value is a `CryptoKey` object reference, never a secret string. This
    // file's keys are generated fresh per test run (see `beforeAll` above)
    // and never leave the test process.
    signer?: CryptoKey;
    kid?: string;
    alg?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: string;
    notBefore?: string;
  } = {},
): Promise<string> {
  const signer = options.signer ?? privateKey;
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: options.alg ?? "RS256", kid: options.kid ?? KID })
    .setIssuedAt()
    .setIssuer(options.issuer ?? "https://accounts.google.com")
    .setAudience(options.audience ?? CLIENT_ID)
    .setExpirationTime(options.expiresIn ?? "1h");
  if (options.notBefore) jwt.setNotBefore(options.notBefore);
  return jwt.sign(signer);
}

describe("verifyGoogleIdToken", () => {
  it("accepts a validly signed Google-shaped token", async () => {
    const token = await signToken(baseClaims());
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe("1234567890");
      expect(result.payload.email).toBe("person@example.com");
      expect(result.payload.emailVerified).toBe(true);
      expect(result.payload.name).toBe("Ada Lovelace");
      expect(result.payload.nonce).toBe("test-nonce-value");
    }
  });

  it("accepts both documented Google issuer values", async () => {
    for (const issuer of ["accounts.google.com", "https://accounts.google.com"]) {
      const token = await signToken(baseClaims(), { issuer });
      const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
      expect(result.ok).toBe(true);
    }
  });

  it("rejects a bad signature (tampered payload)", async () => {
    const token = await signToken(baseClaims());
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(atob(payload!)), sub: "attacker" }),
    ).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    const result = await verifyGoogleIdToken(tampered, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects a token signed by an unrecognized key", async () => {
    const token = await signToken(baseClaims(), { signer: otherPrivateKey, kid: "unknown-kid" });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects an unsupported algorithm", async () => {
    // HS256 with the JWKS's own exported public-key material used as an HMAC
    // secret is the classic algorithm-confusion attack this guards against;
    // simulating it exactly requires a raw HMAC signer, which is out of
    // scope here — instead this proves the `algorithms: ["RS256"]` allow-list
    // itself is enforced by signing with a different, still-asymmetric
    // algorithm (RS384) that Google's real tokens never use.
    const token = await signToken(baseClaims(), { alg: "RS384", signer: rs384PrivateKey });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects the wrong issuer", async () => {
    const token = await signToken(baseClaims(), { issuer: "https://evil.example" });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects the wrong audience", async () => {
    const token = await signToken(baseClaims(), { audience: "someone-elses-client-id" });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects an expired token", async () => {
    const token = await signToken(baseClaims(), { expiresIn: "-1h" });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects a not-yet-valid token", async () => {
    const token = await signToken(baseClaims(), { notBefore: "1h" });
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });

  it("rejects a missing subject", async () => {
    const claims = baseClaims();
    delete (claims as Record<string, unknown>).sub;
    const token = await signToken(claims);
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_subject");
  });

  it("rejects an empty subject", async () => {
    const token = await signToken(baseClaims({ sub: "" }));
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_subject");
  });

  it("rejects a mismatched azp when present", async () => {
    const token = await signToken(baseClaims({ azp: "a-different-client-id" }));
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("azp_mismatch");
  });

  it("accepts a matching azp when present", async () => {
    const token = await signToken(baseClaims({ azp: CLIENT_ID }));
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(true);
  });

  it("accepts a token with no email claim at all (email is optional)", async () => {
    const claims = baseClaims();
    delete (claims as Record<string, unknown>).email;
    delete (claims as Record<string, unknown>).email_verified;
    const token = await signToken(claims);
    const result = await verifyGoogleIdToken(token, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.email).toBeNull();
      expect(result.payload.emailVerified).toBe(false);
    }
  });

  it("never authenticates merely because the payload is decodable — an unsigned token fails", async () => {
    // A base64url-encoded header+payload with `alg: none` and no signature —
    // decodable by anyone, cryptographically worthless.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(baseClaims())).toString("base64url");
    const unsigned = `${header}.${payload}.`;
    const result = await verifyGoogleIdToken(unsigned, { expectedClientId: CLIENT_ID, jwks });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_token");
  });
});
