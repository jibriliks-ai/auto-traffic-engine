import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REQUIRED_FIELDS } from "@/lib/money-engine/platforms";
import type { PlatformId } from "@/lib/money-engine/types";

export const runtime = "nodejs";

/**
 * Phase 1b verification: checks that all required encrypted fields are present.
 * Phase 2 will replace this with a real lightweight API call per platform.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { platform } = await req.json().catch(() => ({}));
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  const account = await prisma.userAffiliateAccount.findUnique({
    where: { userId_platform: { userId, platform: platform as PlatformId } },
  });
  if (!account) return NextResponse.json({ verified: false, message: "No credentials saved yet." });

  const fieldMap: Record<string, string | null | undefined> = {
    affiliateUsername: account.affiliateUsername,
    affiliateId: account.affiliateId,
    apiKey: account.apiKeyEncrypted,
    apiSecret: account.apiSecretEncrypted,
    accessToken: account.accessTokenEncrypted,
    accountId: account.accountId,
  };

  const required = REQUIRED_FIELDS[platform as PlatformId];
  const missing = required.filter((f) => !fieldMap[f]);

  if (missing.length > 0) {
    return NextResponse.json({
      verified: false,
      message: `Missing: ${missing.join(", ")}`,
    });
  }

  await prisma.userAffiliateAccount.update({
    where: { id: account.id },
    data: { isConnected: true, lastVerifiedAt: new Date() },
  });

  return NextResponse.json({
    verified: true,
    message: "Credentials complete. Live API test enabled in Phase 2.",
  });
}