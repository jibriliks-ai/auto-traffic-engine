import crypto from "crypto";
import { prisma } from "./prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000;    // 1 hour
const COOLDOWN_MS = 5 * 60 * 1000;      // 5 min between requests per user
const TOKEN_BYTES = 32;

export function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * We store SHA-256 of the token, not the token itself.
 * If the DB leaks, tokens can't be used to reset passwords.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Cooldown: one active request per user every 5 min
  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) throw new Error("COOLDOWN");

  const token = generateToken();
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      token: tokenHash,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return token;
}

export async function validateResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!record) return { valid: false as const, reason: "not_found" as const };
  if (record.usedAt) return { valid: false as const, reason: "used" as const };
  if (record.expires < new Date())
    return { valid: false as const, reason: "expired" as const };

  return { valid: true as const, record };
}

export async function consumeResetToken(
  recordId: string,
  userId: string,
  newPasswordHash: string
) {
  await prisma.$transaction([
    // Mark this token used
    prisma.passwordResetToken.update({
      where: { id: recordId },
      data: { usedAt: new Date() },
    }),
    // Update password
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    }),
    // Invalidate all other pending tokens for this user
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null, id: { not: recordId } },
      data: { usedAt: new Date() },
    }),
  ]);
}