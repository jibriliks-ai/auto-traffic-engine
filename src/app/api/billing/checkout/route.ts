import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Flutterwave uses MAJOR units: 35 = $35 USD, or 52500 = ₦52,500 NGN
const PREMIUM_AMOUNT = parseInt(
  process.env.FLUTTERWAVE_PREMIUM_AMOUNT ?? "35"
);
const CURRENCY = (process.env.FLUTTERWAVE_CURRENCY ?? "USD").toUpperCase();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Flutterwave is not configured. Add FLUTTERWAVE_SECRET_KEY to your environment.",
      },
      { status: 500 }
    );
  }

  const userId = (session.user as any).id;
  const email = session.user.email!;
  const name = session.user.name ?? undefined;
  const origin = new URL(req.url).origin;
  const redirectUrl = `${origin}/billing`;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (
    user?.plan === "premium" &&
    user.planExpiresAt &&
    user.planExpiresAt > new Date()
  ) {
    return NextResponse.json(
      {
        error: "You already have an active premium subscription.",
        alreadyPremium: true,
      },
      { status: 400 }
    );
  }

  const txRef = `ATE-${userId.slice(0, 8)}-${Date.now()}`;

  console.log(
    `[billing/checkout] Creating ${CURRENCY} ${PREMIUM_AMOUNT} transaction for ${email}`
  );

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: PREMIUM_AMOUNT,
      currency: CURRENCY,
      redirect_url: redirectUrl,
      customer: { email, name },
      customizations: {
        title: "Auto Traffic Engine — Premium",
        description: "Unlimited Q&A, classifieds, indexer, videos, and social posts.",
      },
      meta: { userId, plan: "premium" },
    }),
    signal: AbortSignal.timeout(20000),
  });

  // Read text first — Flutterwave may return HTML (Cloudflare) not JSON
  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    const preview = text.slice(0, 150).replace(/\s+/g, " ");
    console.error(`[billing/checkout] Non-JSON from Flutterwave:`, preview);
    return NextResponse.json(
      {
        error: `Flutterwave returned non-JSON (HTTP ${res.status}). Preview: ${preview}`,
      },
      { status: 502 }
    );
  }

  if (!res.ok || data.status !== "success" || !data.data?.link) {
    console.error(`[billing/checkout] Flutterwave error:`, data);
    return NextResponse.json(
      {
        error: data.message ?? `Flutterwave error (HTTP ${res.status})`,
        flutterwave_response: data,
      },
      { status: 502 }
    );
  }

  await prisma.payment.create({
    data: {
      userId,
      reference: txRef,
      amount: PREMIUM_AMOUNT,
      currency: CURRENCY,
      status: "pending",
      plan: "premium",
    },
  });

  console.log(`[billing/checkout] SUCCESS: ${data.data.link}`);
  return NextResponse.json({
    checkout_url: data.data.link,
    tx_ref: txRef,
  });
}