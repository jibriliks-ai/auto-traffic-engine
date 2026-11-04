import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiChat } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, platform, url } = await req.json();
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });

  const userId = (session.user as any).id;
  const business = await prisma.business.findFirst({ where: { userId } });

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
        { role: "user", content: `Question from ${platform}: ${question}\n\nURL: ${url}` },
      ],
      { maxTokens: 600, temperature: 0.7 }
    );
    return NextResponse.json({ draft });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}