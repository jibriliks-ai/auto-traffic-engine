import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  const id = (body.id ?? "").toString().trim();
  if (!id) return NextResponse.json({ error: "Business id required." }, { status: 400 });

  const business = await prisma.business.findFirst({ where: { id, userId } });
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  await prisma.user.update({
    where: { id: userId },
    data: { activeBusinessId: id },
  });

  return NextResponse.json({ ok: true, activeBusinessId: id });
}