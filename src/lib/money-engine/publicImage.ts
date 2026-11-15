import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "";

/** Sign a link ID → token that can be served publicly via /api/public/image/[token] */
export function signLinkId(linkId: string): string {
  const payload = Buffer.from(linkId, "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(linkId)
    .digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify a signed token and return the link ID, or null if tampered */
export function verifyLinkToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  let linkId: string;
  try {
    linkId = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(linkId)
    .digest("base64url");

  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  return linkId;
}