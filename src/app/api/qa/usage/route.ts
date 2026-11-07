// src/app/api/qa/usage/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkQALimit } from "@/lib/limits";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;
  const plan = (session.user as any).plan ?? "free";
  const usage = await checkQALimit(userId, plan);
  return NextResponse.json(usage);
}