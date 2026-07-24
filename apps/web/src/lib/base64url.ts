export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // `.slice()` (rather than returning `bytes` directly) pins the generic to
  // `Uint8Array<ArrayBuffer>` — TS 5.7's stricter Uint8Array typing
  // otherwise infers `Uint8Array<ArrayBufferLike>`, which @simplewebauthn's
  // `Uint8Array_` (itself `ReturnType<Uint8Array['slice']>`) rejects.
  return bytes.slice();
}
