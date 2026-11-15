import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BOT_UA_REGEX =
  /bot|crawler|spider|facebookexternalhit|tiktok|whatsapp|slack|discord|telegram|preview|skype/i;

/** Ensures URL is absolute. Prepends https:// if missing. */
function absolutize(rawUrl: string | null | undefined): string {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return "https://google.com";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ua = req.headers.get("user-agent") ?? "";
  const isBot = BOT_UA_REGEX.test(ua);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const referrer = req.headers.get("referer")?.slice(0, 500) ?? null;
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  // ── 1. Primary: UserTrackingLink (paste-tracking-link method) ──
  const userLink = await prisma.userTrackingLink.findFirst({
    where: { slug: params.slug, isActive: true },
  });

  if (userLink) {
    const destination = absolutize(userLink.trackingUrl);

    // Fire-and-forget click tracking — never blocks the redirect
    if (!isBot) {
      Promise.all([
        prisma.userTrackingLinkClick
          .create({
            data: {
              linkId: userLink.id,
              userId: userLink.userId,
              ipAddress: ip,
              userAgent: ua.slice(0, 500),
              referrer,
              country,
            },
          })
          .catch(() => {}),
        prisma.userTrackingLink
          .update({
            where: { id: userLink.id },
            data: { clicks: { increment: 1 } },
          })
          .catch(() => {}),
      ]).catch(() => {});
    }

    try {
      return NextResponse.redirect(destination, 301);
    } catch {
      return NextResponse.redirect(absolutize(userLink.merchantUrl), 301);
    }
  }

  // ── 2. Legacy: MoneyEngineLink ──
  const link = await prisma.moneyEngineLink.findFirst({
    where: { slug: params.slug, isActive: true },
  });

  if (!link) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const destination = absolutize(link.destinationUrl);

  if (!isBot) {
    const url = new URL(req.url);
    const platform = url.searchParams.get("src") ?? link.platform ?? null;
    Promise.all([
      prisma.moneyEngineLinkClick
        .create({
          data: {
            linkId: link.id,
            userId: link.userId,
            ipAddress: ip,
            userAgent: ua.slice(0, 500),
            referrer,
            country,
            platform,
          },
        })
        .catch(() => {}),
      prisma.moneyEngineLink
        .update({
          where: { id: link.id },
          data: { clicks: { increment: 1 } },
        })
        .catch(() => {}),
    ]).catch(() => {});
  }

  try {
    return NextResponse.redirect(destination, 301);
  } catch {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }
}