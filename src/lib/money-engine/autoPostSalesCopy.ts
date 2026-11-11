import { prisma } from "@/lib/prisma";
import { generateSalesCopy } from "./salesCopyGenerator";
import { postToLemmy } from "./platforms/lemmyClient";
import { postToAnswer } from "./platforms/answerClient";
import { createOrReuseLink } from "./linkCloaker";

/**
 * Anti-spam scheduling rules (WAT = Nigeria time).
 * Lemmy: max 3/day, 2h apart, at 8am / 1pm / 7pm.
 * Answer: max 5/day, 1h apart, at 9am / 12pm / 3pm / 6pm / 9pm.
 */
const LEMMY_SLOTS_WAT = [8, 13, 19];
const ANSWER_SLOTS_WAT = [9, 12, 15, 18, 21];

/** Compute next available slot for a platform, WAT, respecting daily caps. */
async function nextScheduledTime(
  userId: string,
  platform: "lemmy" | "answer"
): Promise<Date> {
  const slots = platform === "lemmy" ? LEMMY_SLOTS_WAT : ANSWER_SLOTS_WAT;
  const maxPerDay = slots.length;

  // Count today's scheduled+posted items
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayCount = await prisma.moneyEngineSalesCopy.count({
    where: {
      userId,
      platform,
      createdAt: { gte: todayStart },
      status: { in: ["scheduled", "posted"] },
    },
  });

  if (todayCount < maxPerDay) {
    // Schedule for today at the next slot that hasn't passed
    const now = new Date();
    // WAT = UTC+1
    const nowWatHour = (now.getUTCHours() + 1) % 24;
    for (const slot of slots) {
      if (slot > nowWatHour) {
        const target = new Date(now);
        target.setUTCHours(slot - 1, 0, 0, 0); // Convert WAT→UTC
        return target;
      }
    }
  }

  // All today's slots used OR past — schedule for tomorrow at first slot
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const firstSlotWat = slots[0];
  tomorrow.setUTCHours(firstSlotWat - 1, 0, 0, 0);
  return tomorrow;
}

/**
 * Generate one Lemmy + one Answer sales copy for an offer, schedule them.
 * Does NOT post immediately — cron picks them up.
 */
export async function generateAndScheduleSalesCopy(
  userId: string,
  offerId: string
): Promise<{ lemmyCopyId: string; answerCopyId: string; scheduledAt: { lemmy: Date; answer: Date } }> {
  const offer = await prisma.moneyEngineOffer.findUnique({
    where: { id: offerId },
  });
  if (!offer) throw new Error("Offer not found");

  // Create/reuse /go/ short link
  const link = await createOrReuseLink({
    userId,
    offerId: offer.id,
    sourceType: "poster", // using 'poster' bucket since these are text-only; adjust if you add 'sales_copy' type
    platform: "lemmy",
    destinationUrl: offer.salesPageUrl ?? "",
    brandHint: offer.vendor ?? "product",
    productHint: offer.title.split(" ").slice(0, 3).join(" "),
  });

  // Generate both copies in parallel
  const [lemmyCopy, answerCopy] = await Promise.all([
    generateSalesCopy({
      userId,
      offer: {
        id: offer.id,
        title: offer.title,
        vendor: offer.vendor,
        category: offer.category,
        frontEndPrice: offer.frontEndPrice,
        originalPrice: offer.originalPrice,
        salesPageUrl: offer.salesPageUrl,
        swipeCopy: offer.swipeCopy,
      },
      platform: "lemmy",
      shortUrl: link.shortUrl,
    }),
    generateSalesCopy({
      userId,
      offer: {
        id: offer.id,
        title: offer.title,
        vendor: offer.vendor,
        category: offer.category,
        frontEndPrice: offer.frontEndPrice,
        originalPrice: offer.originalPrice,
        salesPageUrl: offer.salesPageUrl,
        swipeCopy: offer.swipeCopy,
      },
      platform: "answer",
      shortUrl: link.shortUrl,
    }),
  ]);

  // Compute scheduled times
  const lemmyAt = await nextScheduledTime(userId, "lemmy");
  const answerAt = await nextScheduledTime(userId, "answer");

  // Persist both
  const [lemmyRow, answerRow] = await Promise.all([
    prisma.moneyEngineSalesCopy.create({
      data: {
        userId,
        offerId: offer.id,
        platform: "lemmy",
        postType: lemmyCopy.postType,
        title: lemmyCopy.title,
        body: lemmyCopy.body,
        hookUsed: lemmyCopy.hookUsed,
        angleUsed: lemmyCopy.angleUsed,
        variationSeed: lemmyCopy.variationSeed,
        shortUrl: link.shortUrl,
        status: "scheduled",
        scheduledAt: lemmyAt,
      },
    }),
    prisma.moneyEngineSalesCopy.create({
      data: {
        userId,
        offerId: offer.id,
        platform: "answer",
        postType: answerCopy.postType,
        title: answerCopy.title,
        body: answerCopy.body,
        hookUsed: answerCopy.hookUsed,
        angleUsed: answerCopy.angleUsed,
        variationSeed: answerCopy.variationSeed,
        shortUrl: link.shortUrl,
        status: "scheduled",
        scheduledAt: answerAt,
      },
    }),
  ]);

  return {
    lemmyCopyId: lemmyRow.id,
    answerCopyId: answerRow.id,
    scheduledAt: { lemmy: lemmyAt, answer: answerAt },
  };
}

/**
 * Cron entry point — posts ONE due item per call, per platform.
 * Called every 30 min by cron-job.org. Never posts 10 at once.
 */
export async function postDueSalesCopy(): Promise<{ posted: number; failed: number }> {
  const now = new Date();

  // Pick at most 1 due Lemmy + 1 due Answer per run
  const [dueLemmy, dueAnswer] = await Promise.all([
    prisma.moneyEngineSalesCopy.findFirst({
      where: {
        platform: "lemmy",
        status: "scheduled",
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.moneyEngineSalesCopy.findFirst({
      where: {
        platform: "answer",
        status: "scheduled",
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  let posted = 0;
  let failed = 0;

  if (dueLemmy) {
    try {
      const result = await postToLemmy(
        dueLemmy.title,
        dueLemmy.body,
        dueLemmy.shortUrl
      );
      await prisma.moneyEngineSalesCopy.update({
        where: { id: dueLemmy.id },
        data: {
          status: "posted",
          postedAt: new Date(),
          lemmyPostId: result.postId,
          lemmyUrl: result.postUrl,
        },
      });
      posted++;
    } catch (e: any) {
      const newRetry = dueLemmy.retryCount + 1;
      await prisma.moneyEngineSalesCopy.update({
        where: { id: dueLemmy.id },
        data: {
          retryCount: newRetry,
          status: newRetry >= 3 ? "failed" : "scheduled",
          lastError: String(e?.message ?? e).slice(0, 1000),
          scheduledAt: newRetry >= 3 ? dueLemmy.scheduledAt : new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      failed++;
    }
  }

  if (dueAnswer) {
    try {
      const result = await postToAnswer(
        dueAnswer.title,
        dueAnswer.body,
        dueAnswer.shortUrl
      );
      await prisma.moneyEngineSalesCopy.update({
        where: { id: dueAnswer.id },
        data: {
          status: "posted",
          postedAt: new Date(),
          answerQuestionId: result.questionId,
          answerAnswerId: result.answerId,
          answerUrl: result.questionUrl,
        },
      });
      posted++;
    } catch (e: any) {
      const newRetry = dueAnswer.retryCount + 1;
      await prisma.moneyEngineSalesCopy.update({
        where: { id: dueAnswer.id },
        data: {
          retryCount: newRetry,
          status: newRetry >= 3 ? "failed" : "scheduled",
          lastError: String(e?.message ?? e).slice(0, 1000),
          scheduledAt: newRetry >= 3 ? dueAnswer.scheduledAt : new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      failed++;
    }
  }

  return { posted, failed };
}