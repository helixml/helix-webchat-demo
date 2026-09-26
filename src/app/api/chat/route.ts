import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { sendTurn, type HelixAttachment } from "@/lib/helix";

export const maxDuration = 300;

/**
 * Browser (Vercel AI SDK useChat)  ->  /api/chat  ->  Helix /api/v1/sessions/chat.
 *
 * The AI SDK transport posts { messages: UIMessage[], ... }. We take the last
 * user message (text + file parts), forward it to the Helix chat gateway with
 * the server-side API key, and stream the reply back as a UI message stream.
 *
 * The Helix session id for this conversation comes in as the `sessionId` body
 * field (empty on first contact) and is returned in the X-Helix-Session header
 * so the browser can store it per contact.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages?: UIMessage[];
    sessionId?: string;
  };
  const incoming = body.messages ?? [];
  const lastUser = [...incoming].reverse().find((m) => m.role === "user");

  let text = "";
  const attachments: HelixAttachment[] = [];
  for (const part of lastUser?.parts ?? []) {
    if (part.type === "text") text += part.text;
    else if (part.type === "file") {
      const url = part.url;
      if (!url.startsWith("data:")) continue;
      const [meta, b64] = url.slice(5).split(",");
      const mediaType = meta.split(";")[0] || "application/octet-stream";
      attachments.push({
        filename: part.filename || `attachment-${attachments.length + 1}`,
        mediaType,
        bytes: Buffer.from(b64, "base64"),
      });
    }
  }

  if (!text.trim() && attachments.length === 0) {
    return new Response("empty message", { status: 400 });
  }

  const helixSessionId = body.sessionId || undefined;

  /**
   * Helix turns can take minutes (the bot drives a real browser). We answer
   * with the UI stream IMMEDIATELY and emit heartbeats while the blocking
   * turn runs, so nothing in the chain idles out and the UI can show progress.
   */
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      let done = false;
      const heartbeat = setInterval(() => {
        if (!done) writer.write({ type: "data-heartbeat", data: { at: Date.now() } });
      }, 5000);
      try {
        let turn: Awaited<ReturnType<typeof sendTurn>>;
        let recreated = false;
        try {
          turn = await sendTurn({ sessionId: helixSessionId, message: text, attachments });
        } catch (firstErr) {
          // A stored session id can go stale (server restart, session deleted).
          // Fall back to a brand-new session once before surfacing the error.
          if (!helixSessionId) throw firstErr;
          turn = await sendTurn({ sessionId: undefined, message: text, attachments });
          recreated = true;
          writer.write({
            type: "data-notice",
            data: { text: "Previous session was unavailable — started a fresh one." },
          });
        }

        const id = "reply";
        writer.write({ type: "text-start", id });
        // stream the reply in small chunks so long answers feel alive
        const chunks = turn.reply.match(/[\s\S]{1,90}/g) ?? [];
        for (const c of chunks) {
          writer.write({ type: "text-delta", id, delta: c });
        }
        writer.write({ type: "text-end", id });
        // echo the session id so the client can pin this conversation to it
        writer.write({ type: "data-session", data: { sessionId: turn.sessionId } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writer.write({
          type: "data-notice",
          data: { text: `Helix backend error: ${message}` },
        });
      } finally {
        done = true;
        clearInterval(heartbeat);
        writer.write({ type: "finish" });
      }
    },
    onError: (err) => String(err),
  });

  return createUIMessageStreamResponse({ stream });
}
