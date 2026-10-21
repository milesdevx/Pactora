import crypto from "crypto";

/**
 * Generate a cryptographically secure random hex string
 */
export function generateRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Hash a sensitive token (such as a link token) using SHA-256 before database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate standard authentication message for wallet signing
 */
export function createAuthMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    "Pactora Authentication",
    "Sign this message to authenticate your wallet with Pactora.",
    `Wallet: ${address.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Terms: This request will not trigger any blockchain transaction or gas fee.",
  ].join("\n");
}

