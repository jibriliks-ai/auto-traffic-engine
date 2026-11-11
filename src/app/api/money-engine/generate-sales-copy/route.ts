import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateAndScheduleSalesCopy } from "@/lib/money-engine/autoPostSalesCopy";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId ?? "").trim();
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  try {
    const result = await generateAndScheduleSalesCopy(userId, offerId);
    return NextResponse.json({
      ok: true,
      ...result,
      scheduledAt: {
        lemmy: result.scheduledAt.lemmy.toISOString(),
        answer: result.scheduledAt.answer.toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Generation failed" },
      { status: 500 }
    );
  }
}