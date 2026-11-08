import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkBusinessLimit } from "@/lib/limits";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — session missing user id. Sign out and back in." },
      { status: 401 }
    );
  }

  const [businesses, user] = await Promise.all([
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { activeBusinessId: true },
    }),
  ]);

  return NextResponse.json({
    businesses,
    activeBusinessId: user?.activeBusinessId ?? null,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const plan = (session?.user as any)?.plan ?? "free";

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — session missing user id. Sign out and back in." },
      { status: 401 }
    );
  }

  const limit = await checkBusinessLimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          plan === "free"
            ? `Free plan allows ${limit.limit ?? 1} business. Upgrade to Premium for 3.`
            : `Your plan allows ${limit.limit ?? 0} businesses.`,
        usage: limit,
        upgradeRequired: plan === "free",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  const website = (body.website ?? "").toString().trim() || null;
  const description = (body.description ?? "").toString().trim() || null;
  const keywords = (body.keywords ?? "").toString().trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  try {
    const business = await prisma.business.create({
      data: { userId, name, website, description, keywords },
    });

    const total = await prisma.business.count({ where: { userId } });
    if (total === 1) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeBusinessId: business.id },
      });
    }

    const updatedLimit = await checkBusinessLimit(userId, plan);
    return NextResponse.json({ business, usage: updatedLimit });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to create business." },
      { status: 500 }
    );
  }
}