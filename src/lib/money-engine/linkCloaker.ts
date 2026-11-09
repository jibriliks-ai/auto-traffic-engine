import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "https://growthbot-aprv.onrender.com";

export interface CreateLinkInput {
  userId: string;
  offerId?: string;
  campaignId?: string;
  contentId?: string;
  sourceType: "video" | "poster" | "qa_answer" | "manual";
  platform?: string;
  destinationUrl: string;
  brandHint?: string;
  productHint?: string;
}

export interface CloakedLink {
  id: string;
  slug: string;
  shortUrl: string;
  qrCodeUrl: string;
  destinationUrl: string;
}

export async function createOrReuseLink(
  input: CreateLinkInput
): Promise<CloakedLink> {
  if (input.offerId) {
    const existing = await prisma.moneyEngineLink.findFirst({
      where: {
        userId: input.userId,
        offerId: input.offerId,
        sourceType: input.sourceType,
        platform: input.platform ?? null,
        isActive: true,
      },
    });
    if (existing) {
      let qrCodeUrl = existing.qrCodeUrl;
      if (!qrCodeUrl) {
        qrCodeUrl = await generateQR(existing.shortUrl);
        await prisma.moneyEngineLink.update({
          where: { id: existing.id },
          data: { qrCodeUrl },
        });
      }
      return {
        id: existing.id,
        slug: existing.slug,
        shortUrl: existing.shortUrl,
        qrCodeUrl,
        destinationUrl: existing.destinationUrl,
      };
    }
  }

  const slug = await generateUniqueSlug(
    input.brandHint ?? "product",
    input.productHint ?? "item"
  );
  const shortUrl = `${APP_DOMAIN}/go/${slug}`;
  const qrCodeUrl = await generateQR(shortUrl);

  const link = await prisma.moneyEngineLink.create({
    data: {
      userId: input.userId,
      offerId: input.offerId ?? null,
      campaignId: input.campaignId ?? null,
      contentId: input.contentId ?? null,
      slug,
      shortUrl,
      destinationUrl: input.destinationUrl,
      qrCodeUrl,
      sourceType: input.sourceType,
      platform: input.platform ?? null,
    },
  });

  return {
    id: link.id,
    slug: link.slug,
    shortUrl: link.shortUrl,
    qrCodeUrl,
    destinationUrl: link.destinationUrl,
  };
}

async function generateUniqueSlug(brand: string, product: string): Promise<string> {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

  const base = `${clean(brand)}-${clean(product)}`.replace(/^-+|-+$/g, "").slice(0, 50);
  const baseSlug = base || "link";

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(100 + Math.random() * 900).toString();
    const slug = `${baseSlug}-${suffix}`.slice(0, 60);
    const existing = await prisma.moneyEngineLink.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  throw new Error("Could not generate unique slug after 10 attempts");
}

async function generateQR(url: string): Promise<string> {
  return await QRCode.toDataURL(url, {
    width: 400,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

export async function updateLinkDestination(
  userId: string,
  linkId: string,
  newDestinationUrl: string
): Promise<void> {
  const link = await prisma.moneyEngineLink.findFirst({
    where: { id: linkId, userId },
  });
  if (!link) throw new Error("Link not found");
  await prisma.moneyEngineLink.update({
    where: { id: linkId },
    data: { destinationUrl: newDestinationUrl },
  });
}

