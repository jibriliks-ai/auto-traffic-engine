import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function renderPasswordResetEmail(resetUrl: string, userName?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#8b5cf6,#3b82f6);padding:32px 24px;text-align:center;">
      <div style="color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Auto Traffic Engine</div>
    </div>
    <div style="padding:32px 24px;">
      <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Reset your password</h1>
      <p style="margin:0 0 16px;color:#4b5563;line-height:1.6;">
        Hi${userName ? " " + userName : ""}, we received a request to reset the password for your Auto Traffic Engine account.
      </p>
      <p style="margin:0 0 24px;color:#4b5563;line-height:1.6;">
        Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
          Reset Password
        </a>
      </div>
      <p style="margin:24px 0 8px;color:#6b7280;font-size:13px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;padding:12px;background:#f3f4f6;border-radius:6px;color:#4b5563;font-size:12px;word-break:break-all;">
        ${resetUrl}
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="margin:0;color:#9ca3af;font-size:13px;">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export type SendEmailResult =
  | { ok: true; dev: true; resetUrl: string }
  | { ok: true; dev: false; id?: string }
  | { ok: false; error: string };

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  userName?: string
): Promise<SendEmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  // Dev mode: no Resend key → log the URL and return it for the UI to show
  if (!resend) {
    console.log(`\n=== PASSWORD RESET (dev mode) ===`);
    console.log(`To: ${to}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`=================================\n`);
    return { ok: true, dev: true, resetUrl };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: "Reset your Auto Traffic Engine password",
      html: renderPasswordResetEmail(resetUrl, userName),
    });

    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { ok: false, error: result.error.message };
    }

    return { ok: true, dev: false, id: result.data?.id };
  } catch (e: any) {
    console.error("[email] Send failed:", e);
    return { ok: false, error: e.message ?? "Email send failed" };
  }
}