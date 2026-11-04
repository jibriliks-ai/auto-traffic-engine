type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function aiChat(messages: Msg[], opts?: { maxTokens?: number; temperature?: number }) {
  const useOpenAI = !!process.env.OPENAI_API_KEY;
  const baseURL = useOpenAI ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
  const apiKey = useOpenAI ? process.env.OPENAI_API_KEY! : process.env.DEEPSEEK_API_KEY!;
  const model = useOpenAI ? "gpt-4o-mini" : "deepseek-chat";

  if (!apiKey) throw new Error("No AI key configured (OPENAI_API_KEY or DEEPSEEK_API_KEY)");

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 1200,
      temperature: opts?.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}