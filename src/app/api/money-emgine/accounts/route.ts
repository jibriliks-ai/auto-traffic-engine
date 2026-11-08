import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/money-engine/crypto";
import { PLATFORM_CONFIG, REQUIRED_FIELDS } from "@/lib/money-engine/platforms";
import type { PlatformId } from "@/lib/money-engine/types";

export const runtime = "nodejs";

const VALID_PLATFORMS = new Set(PLATFORM_CONFIG.map((p) => p.id));

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const rows = await prisma.userAffiliateAccount.findMany({ where: { userId } });
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  const accounts = PLATFORM_CONFIG.map((p) => {
    const row = byPlatform.get(p.id);
    return {
      platform: p.id,
      isConnected: row?.isConnected ?? false,
      affiliateUsername: row?.affiliateUsername ?? null,
      affiliateId: row?.affiliateId ?? null,
      accountId: row?.accountId ?? null,
      hasApiKey: Boolean(row?.apiKeyEncrypted),
      hasApiSecret: Boolean(row?.apiSecretEncrypted),
      hasAccessToken: Boolean(row?.accessTokenEncrypted),
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
    };
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  const platform = body.platform as PlatformId;
  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const existing = await prisma.userAffiliateAccount.findUnique({
    where: { userId_platform: { userId, platform } },
  });

  const patch: any = {};
  if (typeof body.affiliateUsername === "string") patch.affiliateUsername = body.affiliateUsername.trim() || null;
  if (typeof body.affiliateId === "string") patch.affiliateId = body.affiliateId.trim() || null;
  if (typeof body.accountId === "string") patch.accountId = body.accountId.trim() || null;
  if (typeof body.apiKey === "string" && body.apiKey.trim()) patch.apiKeyEncrypted = encryptSecret(body.apiKey.trim());
  if (typeof body.apiSecret === "string" && body.apiSecret.trim()) patch.apiSecretEncrypted = encryptSecret(body.apiSecret.trim());
  if (typeof body.accessToken === "string" && body.accessToken.trim()) patch.accessTokenEncrypted = encryptSecret(body.accessToken.trim());

  const merged = { ...existing, ...patch } as any;
  const required = REQUIRED_FIELDS[platform];
  const fieldMap: Record<string, string> = {
    affiliateUsername: "affiliateUsername",
    affiliateId: "affiliateId",
    apiKey: "apiKeyEncrypted",
    apiSecret: "apiSecretEncrypted",
    accessToken: "accessTokenEncrypted",
    accountId: "accountId",
  };
  const isConnected = required.every((f) => Boolean(merged[fieldMap[f]]));
  patch.isConnected = isConnected;

  const saved = await prisma.userAffiliateAccount.upsert({
    where: { userId_platform: { userId, platform } },
    create: { userId, platform, ...patch },
    update: patch,
  });

  return NextResponse.json({
    ok: true,
    account: {
      platform: saved.platform,
      isConnected: saved.isConnected,
      lastVerifiedAt: saved.lastVerifiedAt,
    },
  });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as PlatformId;
  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  await prisma.userAffiliateAccount.deleteMany({ where: { userId, platform } });
  return NextResponse.json({ ok: true });
}