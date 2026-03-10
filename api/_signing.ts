// Shared HMAC-SHA256 signing utility for edge functions.
// Must stay in sync with src/utils/signing.ts.
const SIGNING_KEY_HEX = "3f7a2b8c1e4d9f0a5c6b2e8d3a7f4c1b9e5d2a8c6f3b7e4d1a9c5f2b8e7d3a1c";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(SIGNING_KEY_HEX),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function verifyPayload(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await getKey();
    const data = new TextEncoder().encode(payload);
    const sigBytes = hexToBytes(signature);
    return await crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}
