import { webcrypto } from "node:crypto";
import { cose, isoCBOR } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { base64UrlToBytes, bytesToBase64Url } from "../../src/lib/base64url";

const { COSEKEYS, COSEKTY, COSECRV, COSEALG } = cose;

/**
 * A real (not stubbed) software WebAuthn authenticator for integration
 * tests: generates an actual P-256 keypair and produces byte-for-byte valid
 * CBOR attestation objects / DER-signed assertions that
 * `verifyRegistrationResponse`/`verifyAuthenticationResponse` (real
 * @simplewebauthn/server code, not a mock of it) will cryptographically
 * accept. This is what lets the auth integration tests exercise the full
 * register→login pipeline instead of stopping at "the challenge token
 * round-tripped."
 *
 * Always reports signCount 0 — real platform authenticators commonly do
 * the same, and verifyAuthenticationResponse explicitly tolerates
 * counter === credential.counter === 0 forever (see its `counter > 0 ||
 * credential.counter > 0` guard) — so this isn't cutting a corner, it's
 * matching a real, common authenticator behaviour.
 */
export type VirtualCredential = {
  credentialId: Uint8Array;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

export async function createVirtualCredential(): Promise<VirtualCredential> {
  const keyPair = (await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const credentialId = webcrypto.getRandomValues(new Uint8Array(32));
  return { credentialId, privateKey: keyPair.privateKey, publicKey: keyPair.publicKey };
}

function concatBytes(...parts: Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await webcrypto.subtle.digest("SHA-256", data));
}

async function coseKeyBytes(publicKey: CryptoKey): Promise<Uint8Array> {
  const jwk = await webcrypto.subtle.exportKey("jwk", publicKey);
  const coseKey = new Map<number, number | Uint8Array>();
  coseKey.set(COSEKEYS.kty, COSEKTY.EC2);
  coseKey.set(COSEKEYS.alg, COSEALG.ES256);
  coseKey.set(COSEKEYS.crv, COSECRV.P256);
  coseKey.set(COSEKEYS.x, base64UrlToBytes(jwk.x!));
  coseKey.set(COSEKEYS.y, base64UrlToBytes(jwk.y!));
  return new Uint8Array(isoCBOR.encode(coseKey));
}

/** DER-encodes an unsigned big-endian integer per ASN.1 (leading 0x00 if the high bit is set). */
function encodeDerInteger(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  let trimmed = bytes.slice(start);
  if ((trimmed[0]! & 0x80) !== 0) trimmed = concatBytes(new Uint8Array([0x00]), trimmed);
  return concatBytes(new Uint8Array([0x02, trimmed.length]), trimmed);
}

/** Wraps a raw (r||s) WebCrypto ECDSA signature in the ASN.1 DER SEQUENCE WebAuthn requires. */
function encodeDerSignature(raw: Uint8Array): Uint8Array {
  const body = concatBytes(encodeDerInteger(raw.slice(0, 32)), encodeDerInteger(raw.slice(32, 64)));
  return concatBytes(new Uint8Array([0x30, body.length]), body);
}

async function buildAuthenticatorData(
  rpID: string,
  credential: VirtualCredential,
  includeAttestedCredentialData: boolean,
): Promise<Uint8Array> {
  const rpIdHash = await sha256(new TextEncoder().encode(rpID));
  const flags = includeAttestedCredentialData ? 0x45 : 0x05; // UP(0x01) | UV(0x04) | AT(0x40)
  const counter = new Uint8Array(4);

  if (!includeAttestedCredentialData) {
    return concatBytes(rpIdHash, new Uint8Array([flags]), counter);
  }

  const aaguid = new Uint8Array(16);
  const credentialIdLength = new Uint8Array(2);
  new DataView(credentialIdLength.buffer).setUint16(0, credential.credentialId.length, false);
  const publicKeyBytes = await coseKeyBytes(credential.publicKey);

  return concatBytes(
    rpIdHash,
    new Uint8Array([flags]),
    counter,
    aaguid,
    credentialIdLength,
    credential.credentialId,
    publicKeyBytes,
  );
}

export async function simulateRegistration(
  credential: VirtualCredential,
  challenge: string,
  rpID: string,
  origin: string,
): Promise<RegistrationResponseJSON> {
  const clientDataJSONBytes = new TextEncoder().encode(
    JSON.stringify({ type: "webauthn.create", challenge, origin, crossOrigin: false }),
  );
  const authenticatorData = await buildAuthenticatorData(rpID, credential, true);

  const attestationObjectMap = new Map<string, unknown>([
    ["fmt", "none"],
    ["attStmt", new Map()],
    ["authData", authenticatorData],
  ]);
  const attestationObject = new Uint8Array(
    isoCBOR.encode(attestationObjectMap as Parameters<typeof isoCBOR.encode>[0]),
  );

  const credentialIdB64 = bytesToBase64Url(credential.credentialId);
  return {
    id: credentialIdB64,
    rawId: credentialIdB64,
    response: {
      clientDataJSON: bytesToBase64Url(clientDataJSONBytes),
      attestationObject: bytesToBase64Url(attestationObject),
      transports: ["internal"],
    },
    clientExtensionResults: {},
    type: "public-key",
  };
}

export async function simulateAuthentication(
  credential: VirtualCredential,
  challenge: string,
  rpID: string,
  origin: string,
): Promise<AuthenticationResponseJSON> {
  const clientDataJSONBytes = new TextEncoder().encode(
    JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
  );
  const clientDataHash = await sha256(clientDataJSONBytes);
  const authenticatorData = await buildAuthenticatorData(rpID, credential, false);

  const signatureBase = concatBytes(authenticatorData, clientDataHash);
  const rawSignature = new Uint8Array(
    await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      credential.privateKey,
      signatureBase,
    ),
  );

  const credentialIdB64 = bytesToBase64Url(credential.credentialId);
  return {
    id: credentialIdB64,
    rawId: credentialIdB64,
    response: {
      clientDataJSON: bytesToBase64Url(clientDataJSONBytes),
      authenticatorData: bytesToBase64Url(authenticatorData),
      signature: bytesToBase64Url(encodeDerSignature(rawSignature)),
    },
    clientExtensionResults: {},
    type: "public-key",
  };
}
