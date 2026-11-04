import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.business.findFirst({
    where: { id: params.id, userId },
  });
  if (!existing) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};

  if (typeof body.name === "string" && body.name.trim().length >= 2) {
    data.name = body.name.trim();
  }
  if (typeof body.website === "string" && body.website.trim()) {
    let w = body.website.trim();
    if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
    try {
      new URL(w);
      data.website = w;
    } catch {
      return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
    }
  }
  if (typeof body.keywords === "string" && body.keywords.trim()) {
    data.keywords = body.keywords.trim();
  }
  if (typeof body.description === "string" && body.description.trim().length >= 20) {
    data.description = body.description.trim();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const business = await prisma.business.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ business });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.business.findFirst({
    where: { id: params.id, userId },
  });
  if (!existing) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  await prisma.business.delete({ where: { id: params.id } });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeBusinessId: true },
  });
  if (user?.activeBusinessId === params.id) {
    const next = await prisma.business.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { activeBusinessId: next?.id ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}