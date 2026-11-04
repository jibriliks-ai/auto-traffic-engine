import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessLimits, getActiveBusiness } from "@/lib/business";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const [limits, { active, businesses }] = await Promise.all([
    getBusinessLimits(userId),
    getActiveBusiness(userId),
  ]);

  return NextResponse.json({
    businesses,
    activeBusinessId: active?.id ?? null,
    limits,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const limits = await getBusinessLimits(userId);
  if (!limits.allowed) {
    return NextResponse.json(
      {
        error:
          limits.plan === "free"
            ? "Free plan allows 1 business. Upgrade to Premium to add more."
            : `You've reached the maximum of ${limits.limit} businesses.`,
        limits,
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  const website = (body.website ?? "").toString().trim();
  const keywords = (body.keywords ?? "").toString().trim();
  const description = (body.description ?? "").toString().trim();

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Business name is required (min 2 chars)." }, { status: 400 });
  }
  if (!website) {
    return NextResponse.json({ error: "Website URL is required." }, { status: 400 });
  }
  let normalizedWebsite = website;
  if (!/^https?:\/\//i.test(normalizedWebsite)) normalizedWebsite = `https://${normalizedWebsite}`;
  try {
    new URL(normalizedWebsite);
  } catch {
    return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
  }
  if (!keywords) {
    return NextResponse.json({ error: "At least one keyword is required." }, { status: 400 });
  }
  if (!description || description.length < 20) {
    return NextResponse.json({ error: "Description is required (min 20 chars)." }, { status: 400 });
  }

  const business = await prisma.business.create({
    data: { userId, name, website: normalizedWebsite, keywords, description },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeBusinessId: true },
  });
  if (!user?.activeBusinessId) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeBusinessId: business.id },
    });
  }

  return NextResponse.json({ business }, { status: 201 });
}