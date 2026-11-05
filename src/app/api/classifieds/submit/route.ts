import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  const siteName = (body.siteName ?? "").toString().trim();
  const siteUrl = (body.siteUrl ?? "").toString().trim();
  const siteCategory = (body.siteCategory ?? "general").toString().trim();
  const country = (body.country ?? "").toString().trim();
  const title = (body.title ?? "").toString().trim();

  if (!siteName || !siteUrl) {
    return NextResponse.json({ error: "Site name and URL are required." }, { status: 400 });
  }

  const { active: business } = await getActiveBusiness(userId);

  try {
    const submission = await prisma.submission.create({
      data: {
        userId,
        businessId: business?.id ?? null,
        type: "classified",
        platform: siteName,
        url: siteUrl,
        submittedUrl: siteUrl,
        status: "submitted",
        country: country || null,
      },
    });
    return NextResponse.json({ submission });
  } catch (e: any) {
    console.error("[classifieds/submit] error:", e);
    return NextResponse.json(
      { error: `Save failed: ${e.message}` },
      { status: 500 }
    );
  }
}