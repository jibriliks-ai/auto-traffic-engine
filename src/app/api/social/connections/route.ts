import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  saveConnection,
  deleteConnection,
  getConnections,
} from "@/lib/social/poster";
import type { SocialPlatform } from "@/lib/social/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await getConnections(userId);
  return NextResponse.json({ connections });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const platform = body.platform as SocialPlatform;
  const accountName = String(body.accountName ?? "").trim();
  const credentials = body.credentials ?? {};

  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });
  if (!accountName) return NextResponse.json({ error: "accountName required" }, { status: 400 });

  // Validation per platform
  const required: Record<SocialPlatform, string[]> = {
    telegram: ["botToken", "chatId"],
    bluesky: ["handle", "appPassword"],
    mastodon: ["instanceUrl", "accessToken"],
    facebook: ["pageId", "pageAccessToken"],
    x: ["apiKey", "apiSecret", "accessToken", "accessSecret"],
  };

  const missing = (required[platform] ?? []).filter((k) => !credentials[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing fields: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await saveConnection(userId, platform, accountName, credentials);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as SocialPlatform;
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  await deleteConnection(userId, platform);
  return NextResponse.json({ ok: true });
}