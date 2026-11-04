import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Flutterwave not configured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const transactionId = body.transaction_id?.toString().trim();
  const txRef = body.tx_ref?.toString().trim();

  if (!transactionId && !txRef) {
    return NextResponse.json(
      { error: "Missing transaction_id or tx_ref." },
      { status: 400 }
    );
  }

  const userId = (session.user as any).id;

  // Find our pending payment record by tx_ref (we always have it)
  const payment = await prisma.payment.findFirst({
    where: txRef ? { reference: txRef, userId } : { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) {
    return NextResponse.json(
      { error: "No matching payment found for this account." },
      { status: 404 }
    );
  }

  // Ask Flutterwave what actually happened — use the transaction ID
  const idToVerify = transactionId ?? payment.reference;
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(idToVerify)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    }
  );
  const data = await res.json();

  const tx = data?.data;
  const isSuccessful =
    res.ok && data.status === "success" && tx?.status === "successful";

  // Double-check that the verified transaction matches our tx_ref and amount
  if (
    isSuccessful &&
    tx?.tx_ref &&
    payment.reference !== tx.tx_ref
  ) {
    return NextResponse.json(
      { error: "Transaction reference mismatch." },
      { status: 409 }
    );
  }
  if (isSuccessful && tx?.amount && tx.amount < payment.amount) {
    return NextResponse.json(
      { error: "Paid amount is less than required." },
      { status: 409 }
    );
  }

  if (!isSuccessful) {
    return NextResponse.json(
      {
        paid: false,
        error: data.message ?? "Payment not successful yet.",
      },
      { status: 402 }
    );
  }

  // Idempotent upgrade — safe even if the webhook fired first
  const alreadyPaid = payment.status === "success";
  if (!alreadyPaid) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "success",
          paidAt: new Date(),
          channel: tx.payment_type ?? null,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          plan: "premium",
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);
  }

  return NextResponse.json({
    paid: true,
    tx_ref: payment.reference,
    transaction_id: transactionId ?? null,
    amount: tx.amount,
    currency: tx.currency,
    alreadyProcessed: alreadyPaid,
  });
}