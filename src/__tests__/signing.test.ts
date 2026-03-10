import { test, expect, describe } from "bun:test";
import { signPayload, verifyPayload } from "@/utils/signing";

describe("signing", () => {
  test("signPayload produces a 64-character hex string", async () => {
    const sig = await signPayload('{"action":"start"}');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  test("verifyPayload returns true for a valid signature", async () => {
    const payload = '{"action":"finish","visitorId":"abc123"}';
    const sig = await signPayload(payload);
    expect(await verifyPayload(payload, sig)).toBe(true);
  });

  test("verifyPayload returns false when payload is tampered", async () => {
    const payload = '{"action":"finish","score":50}';
    const sig = await signPayload(payload);
    const tampered = '{"action":"finish","score":100}';
    expect(await verifyPayload(tampered, sig)).toBe(false);
  });

  test("verifyPayload returns false for an empty signature", async () => {
    const payload = '{"action":"start"}';
    expect(await verifyPayload(payload, "")).toBe(false);
  });

  test("verifyPayload returns false for a garbage signature", async () => {
    const payload = '{"action":"start"}';
    expect(await verifyPayload(payload, "deadbeef")).toBe(false);
  });

  test("different payloads produce different signatures", async () => {
    const sig1 = await signPayload('{"score":50}');
    const sig2 = await signPayload('{"score":100}');
    expect(sig1).not.toBe(sig2);
  });
});
