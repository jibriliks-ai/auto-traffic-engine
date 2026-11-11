import type { PostPayload, PostResult } from "../types";

/**
 * Telegram — free forever, no approval.
 * Create bot: message @BotFather → /newbot → copy token.
 * Chat ID: message @userinfobot to get your chat_id, or use channel @username.
 */
export async function postToTelegram(
  credentials: { botToken: string; chatId: string },
  payload: PostPayload
): Promise<PostResult> {
  try {
    const caption = payload.caption.slice(0, 1024); // Telegram caption limit

    if (payload.imageBuffer) {
      const form = new FormData();
      form.append("chat_id", credentials.chatId);
      form.append("caption", caption);
      form.append(
        "photo",
        new Blob([new Uint8Array(payload.imageBuffer)], { type: "image/jpeg" }),
        "image.jpg"
      );

      const res = await fetch(
        `https://api.telegram.org/bot${credentials.botToken}/sendPhoto`,
        { method: "POST", body: form, signal: AbortSignal.timeout(30_000) }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: `Telegram: ${data.description ?? res.status}` };
      }
      const msg = data.result;
      return {
        ok: true,
        platformPostId: String(msg.message_id),
        platformUrl: `https://t.me/c/${credentials.chatId}/${msg.message_id}`,
      };
    }

    // Text-only fallback
    const res = await fetch(
      `https://api.telegram.org/bot${credentials.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: credentials.chatId, text: caption }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: `Telegram: ${data.description ?? res.status}` };
    }
    return {
      ok: true,
      platformPostId: String(data.result.message_id),
      platformUrl: `https://t.me/c/${credentials.chatId}/${data.result.message_id}`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Telegram network error" };
  }
}