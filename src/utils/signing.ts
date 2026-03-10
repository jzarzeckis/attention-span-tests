// Shared HMAC-SHA256 signing utility.
// The secret is embedded in the bundle intentionally — this is a lightweight
// anti-tampering measure, not a cryptographic access-control system.
// It raises the bar for crafting fake submissions without any server-side auth.
const SIGNING_KEY_HEX = "3f7a2b8c1e4d9f0a5c6b2e8d3a7f4c1b9e5d2a8c6f3b7e4d1a9c5f2b8e7d3a1c";

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getKey(usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(SIGNING_KEY_HEX),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export async function signPayload(payload: string): Promise<string> {
  const key = await getKey(["sign"]);
  const data = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return bytesToHex(new Uint8Array(sig));
}

export async function verifyPayload(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await getKey(["verify"]);
    const data = new TextEncoder().encode(payload);
    const sigBytes = hexToBytes(signature);
    return await crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}
