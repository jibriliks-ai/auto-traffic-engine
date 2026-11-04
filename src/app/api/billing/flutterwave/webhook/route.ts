import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Timing-safe string compare (avoids leaking secret length via early-exit).
 */
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  // Flutterwave sends the pre-shared secret in the `verif-hash` header.
  // It's a DIRECT string comparison — NOT an HMAC of the body.
  const signature = req.headers.get("verif-hash") ?? "";
  if (!safeEqual(signature, secretHash)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Successful charge: event === "charge.completed" and data.status === "successful"
  if (event.event === "charge.completed" && event.data?.status === "successful") {
    const tx = event.data;
    const txRef: string | undefined = tx.tx_ref;
    const userIdFromMeta: string | undefined = tx.meta?.userId;
    const email: string | undefined = tx.customer?.email;

    // Locate the user — prefer metadata.userId, fall back to email
    const user = userIdFromMeta
      ? await prisma.user.findUnique({ where: { id: userIdFromMeta } })
      : email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (user && txRef) {
      const existing = await prisma.payment.findUnique({
        where: { reference: txRef },
      });

      // If the verify route already fulfilled this, don't double-apply
      if (existing && existing.status === "success") {
        return NextResponse.json({ ok: true, skipped: "already processed" });
      }

      await prisma.$transaction([
        prisma.payment.upsert({
          where: { reference: txRef },
          create: {
            userId: user.id,
            reference: txRef,
            amount: tx.amount ?? 0,
            currency: tx.currency ?? "NGN",
            status: "success",
            plan: "premium",
            channel: tx.payment_type ?? null,
            paidAt: new Date(),
          },
          update: {
            status: "success",
            paidAt: new Date(),
            channel: tx.payment_type ?? null,
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "premium",
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);
    }
  }

  // Always return 200 quickly so Flutterwave doesn't retry
  return NextResponse.json({ ok: true });
}