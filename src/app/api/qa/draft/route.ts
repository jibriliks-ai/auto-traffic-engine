import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiChat } from "@/lib/ai";
import { getActiveBusiness } from "@/lib/business";
import { checkQALimit, recordQAActivity } from "@/lib/limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const plan = (session.user as any).plan ?? "free";

  // Free tier: 5 Q&A interactions per day
  const limit = await checkQALimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `You've used your ${limit.limit} free Q&A interactions for today. Upgrade to Premium for unlimited.`,
        usage: limit,
        upgradeRequired: true,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const question = (body.question ?? "").toString().trim();
  const platform = (body.platform ?? "Reddit").toString().trim();
  const url = (body.url ?? "").toString().trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const { active: business } = await getActiveBusiness(userId);

  const style =
    platform === "StackExchange"
      ? "Professional, technical, no emojis. Lead with a direct answer."
      : "Casual, human, helpful. 1-2 sentences of empathy first.";

  const systemPrompt = `You are an expert sales copywriter. Write a helpful forum reply.

Business: ${business?.name ?? "the business"}
Website: ${business?.website ?? "our website"}
Keywords: ${business?.keywords ?? "relevant keywords"}
Description: ${business?.description ?? "our product"}

Rules:
- Style: ${style}
- Open with a genuinely helpful answer (150 words).
- Then a soft CTA to visit the website — mention it naturally once.
- No spam, no hype, no emojis beyond one if platform is Reddit.
- For platform ${platform}, match the cultural tone.
- End with the link on its own line.
- Output ONLY the reply text, no preamble.`;

  try {
    const draft = await aiChat(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Question from ${platform}: ${question}\n\nURL: ${url}`,
        },
      ],
      { maxTokens: 600, temperature: 0.7 }
    );

    // Only count a successful draft against the quota
    if (draft && draft.length > 20) {
      await recordQAActivity(userId, "draft", question.slice(0, 200));
    }

    const updatedLimit = await checkQALimit(userId, plan);
    return NextResponse.json({ draft, usage: updatedLimit });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "AI draft failed." },
      { status: 500 }
    );
  }
}