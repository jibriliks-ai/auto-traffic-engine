import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";

export const runtime = "nodejs";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "question"}-${suffix}`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").toString().trim();
  const answer = (body.answer ?? "").toString().trim();
  const sourceUrl = (body.sourceUrl ?? "").toString().trim();
  const sourcePlatform = (body.sourcePlatform ?? "Reddit").toString().trim();

  if (!title || title.length < 10) {
    return NextResponse.json(
      { error: "Title is required (min 10 chars)." },
      { status: 400 }
    );
  }
  if (!answer || answer.length < 50) {
    return NextResponse.json(
      { error: "Answer is required (min 50 chars)." },
      { status: 400 }
    );
  }
  if (!sourceUrl) {
    return NextResponse.json({ error: "Source URL is required." }, { status: 400 });
  }

  const { active: business } = await getActiveBusiness(userId);
  const slug = slugify(title);

  try {
    const post = await prisma.qAPost.create({
      data: {
        slug,
        userId,
        businessId: business?.id ?? null,
        title,
        body: answer,
        sourceUrl,
        sourcePlatform,
      },
    });

    return NextResponse.json({
      post,
      url: `/qa/${post.slug}`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Save failed: ${e.message}` },
      { status: 500 }
    );
  }
}