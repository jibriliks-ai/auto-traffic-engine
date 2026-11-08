import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/businesses/active
 *
 * Sets the user's active business.
 *
 * Accepts the id in ANY of these shapes (defence-in-depth — callers
 * vary across the codebase):
 *   { businessId: "..." }
 *   { id: "..." }
 *   { business_id: "..." }
 *   ?businessId=...
 *   ?id=...
 *
 * Verifies ownership before updating.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  // Read body safely — req.json() throws if no body
  const body = await req.json().catch(() => ({} as any));
  const url = new URL(req.url);

  const businessId =
    body?.businessId ??
    body?.id ??
    body?.business_id ??
    url.searchParams.get("businessId") ??
    url.searchParams.get("id") ??
    url.searchParams.get("business_id");

  if (!businessId || typeof businessId !== "string" || !businessId.trim()) {
    return NextResponse.json(
      { error: "Business id required. Send { businessId } in body or ?businessId= in query." },
      { status: 400 }
    );
  }

  // Verify the business exists AND belongs to this user
  const business = await prisma.business.findFirst({
    where: { id: businessId.trim(), userId },
    select: { id: true, name: true },
  });

  if (!business) {
    return NextResponse.json(
      { error: "Business not found or does not belong to you." },
      { status: 404 }
    );
  }

  // Persist as the user's active business
  await prisma.user.update({
    where: { id: userId },
    data: { activeBusinessId: business.id },
  });

  return NextResponse.json({
    ok: true,
    business,
    activeBusinessId: business.id,
  });
}

/**
 * GET /api/businesses/active
 * Convenience — returns the current user's active business id.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeBusinessId: true },
  });

  return NextResponse.json({ activeBusinessId: user?.activeBusinessId ?? null });
}