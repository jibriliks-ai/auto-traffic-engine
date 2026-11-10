import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";
import { autoSubmitAfterCreate } from "@/lib/seo/indexNow";

export const runtime = "nodejs";

/** URL-safe slug from arbitrary text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Generate a unique slug — appends random suffix on collision */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "qa";
  for (let i = 0; i < 10; i++) {
    const candidate =
      i === 0 ? base : `${base.slice(0, 70)}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await prisma.qAPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base.slice(0, 70)}-${Date.now().toString(36)}`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — sign out and back in." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const answer = String(body.answer ?? "").trim();
  const sourceUrl = String(body.sourceUrl ?? "").trim();
  const sourcePlatform = String(body.sourcePlatform ?? "Reddit").trim();

  if (!title || title.length < 3) {
    return NextResponse.json(
      { error: "Title is required (min 3 chars)." },
      { status: 400 }
    );
  }
  if (!answer || answer.length < 10) {
    return NextResponse.json(
      { error: "Answer is required (min 10 chars)." },
      { status: 400 }
    );
  }

  // Prevent accidental double-publish — same user + same title in the last hour
  const recent = await prisma.qAPost.findFirst({
    where: {
      userId,
      title: title.slice(0, 300),
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true },
  });
  if (recent) {
    return NextResponse.json({
      id: recent.id,
      slug: recent.slug,
      url: `/qa/${recent.slug}`,
      deduplicated: true,
    });
  }

  // Pull the active business for the QAPost (optional — makes the post show brand context)
  const { active: business } = await getActiveBusiness(userId);

  const slug = await generateUniqueSlug(title);

  let qaPost;
  try {
    qaPost = await prisma.qAPost.create({
      data: {
        slug,
        userId,
        businessId: business?.id ?? null,
        title: title.slice(0, 300),
        body: answer,
        sourceUrl: sourceUrl || "",
        sourcePlatform,
        status: "published",
      },
      select: { id: true, slug: true },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to publish Q&A." },
      { status: 500 }
    );
  }

  // ─── AUTOMATION: Submit to Bing + Yandex via IndexNow ───
  // Fire-and-forget — never blocks the response, never throws.
  // Deduped automatically (won't re-submit same URL within 24h).
  const appDomain =
    process.env.NEXTAUTH_URL ?? "https://growthbot-aprv.onrender.com";
  const publicUrl = `${appDomain}/qa/${qaPost.slug}`;
  autoSubmitAfterCreate(publicUrl);

  return NextResponse.json({
    id: qaPost.id,
    slug: qaPost.slug,
    url: `/qa/${qaPost.slug}`,
    publicUrl,
  });
}