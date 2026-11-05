import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { validateResetToken, consumeResetToken } from "@/lib/password-reset";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body.token ?? "").toString().trim();
  const password = (body.password ?? "").toString();

  if (!token) {
    return NextResponse.json(
      { error: "Reset token is required." },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (password.length > 200) {
    return NextResponse.json(
      { error: "Password is too long." },
      { status: 400 }
    );
  }

  const validation = await validateResetToken(token);

  if (!validation.valid) {
    const message =
      validation.reason === "expired"
        ? "This reset link has expired. Please request a new one."
        : validation.reason === "used"
        ? "This reset link has already been used."
        : "Invalid reset link. Please request a new one.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await consumeResetToken(
      validation.record.id,
      validation.record.userId,
      passwordHash
    );

    return NextResponse.json({
      ok: true,
      message: "Password reset successfully. You can now sign in.",
      email: validation.record.user.email,
    });
  } catch (e: any) {
    console.error("[reset-password] error:", e);
    return NextResponse.json(
      { error: "Could not reset password. Please try again." },
      { status: 500 }
    );
  }
}