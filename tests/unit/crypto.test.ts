import { describe, it, expect } from "vitest";
import { generateRandomToken, hashToken, createAuthMessage } from "@/lib/security/crypto";

describe("Crypto Security Utilities", () => {
  it("generates a random hex token of specified byte length", () => {
    const token = generateRandomToken(32);
    expect(token).toBeDefined();
    expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("produces consistent SHA-256 hashes", () => {
    const input = "test-token-12345";
    const hash1 = hashToken(input);
    const hash2 = hashToken(input);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("creates structured auth messages containing address and nonce", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const nonce = "random-nonce-abc";
    const issuedAt = new Date().toISOString();
    const message = createAuthMessage(address, nonce, issuedAt);

    expect(message).toContain("Pactora Authentication");
    expect(message).toContain(address.toLowerCase());
    expect(message).toContain(nonce);
  });
});

