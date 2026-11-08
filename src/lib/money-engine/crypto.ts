import crypto from "crypto";

/**
 * AES-256-GCM encryption for affiliate API keys/secrets.
 * ENCRYPTION_KEY must be 64 hex chars (32 bytes).
 * Format: {iv_hex}:{tag_hex}:{ciphertext_base64}
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivHex, tagHex, ctB64] = payload.split(":");
  if (!ivHex || !tagHex || !ctB64) throw new Error("Malformed encrypted payload");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return out.toString("utf8");
}