import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Anti-enumeration: identical response whether the email exists or not
  const publicResponse = {
    ok: true,
    message: "If that email exists, we've sent a reset link.",
  };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(publicResponse);
    }

    let token: string;
    try {
      token = await createPasswordResetToken(user.id);
    } catch (e: any) {
      if (e.message === "COOLDOWN") {
        return NextResponse.json({
          ok: true,
          message:
            "A reset link was recently sent. Check your inbox or wait 5 minutes before trying again.",
        });
      }
      throw e;
    }

    const result = await sendPasswordResetEmail(
      user.email,
      token,
      user.name ?? undefined
    );

    if (!result.ok) {
      console.error("[forgot-password] email failed:", result.error);
      return NextResponse.json(
        { error: "Could not send reset email. Try again in a moment." },
        { status: 502 }
      );
    }

    // In dev (no RESEND_API_KEY), return the URL so the UI can show it
    if (result.dev) {
      return NextResponse.json({
        ...publicResponse,
        devResetUrl: result.resetUrl,
      });
    }

    return NextResponse.json(publicResponse);
  } catch (e: any) {
    console.error("[forgot-password] error:", e);
    return NextResponse.json(
      { error: "Could not process request. Try again in a moment." },
      { status: 500 }
    );
  }
}