import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const submission = await prisma.submission.findUnique({ where: { id: params.id } });
  if (!submission) return NextResponse.redirect(new URL("/", req.url));

  // Fire-and-forget click increment
  prisma.submission.update({
    where: { id: params.id },
    data: { clicks: { increment: 1 } },
  }).catch(() => {});

  // Optional lead webhook
  if (process.env.LEADS_WEBHOOK_URL) {
    fetch(process.env.LEADS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: submission.id,
        userId: submission.userId,
        platform: submission.platform,
        submittedUrl: submission.submittedUrl,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  return NextResponse.redirect(submission.submittedUrl);
}