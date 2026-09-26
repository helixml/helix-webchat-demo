/**
 * Minimal typed client for the Helix HTTP API used by this demo.
 *
 * Docs: see docs/API.md. Auth is a Bearer key in the Authorization header:
 *   - HELIX_API_KEY (org API key): full access - chat, read interactions, usage.
 *   - a bot's app API key also works for chat (the gateway then creates a new
 *     session when session_id is omitted) but cannot read interactions.
 */

const HELIX_URL = (process.env.HELIX_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const HELIX_API_KEY = process.env.HELIX_API_KEY ?? "";
const BOT_APP_ID = process.env.HELIX_BOT_APP_ID ?? "";

export type HelixFilePart = { type: "file"; file: { filename: string; file_data: string } };
export type HelixImagePart = { type: "image_url"; image_url: { url: string } };
export type HelixPart = { type: "text"; text: string } | HelixFilePart | HelixImagePart;

export type HelixAttachment = {
  /** e.g. "invoice.pdf", "photo.png" */
  filename: string;
  /** mime type, e.g. "application/pdf" or "image/png" */
  mediaType: string;
  /** raw bytes */
  bytes: Uint8Array;
};

export type HelixTurn = {
  sessionId: string;
  /** the raw turn blob (thinking + tool calls + reply) */
  raw: string;
  /** the user-visible reply (text after the turn's last tool call) */
  reply: string;
};

function authHeaders(extra?: Record<string, string>): HeadersInit {
  if (!HELIX_API_KEY) throw new Error("HELIX_API_KEY is not set");
  return { Authorization: `Bearer ${HELIX_API_KEY}`, "Content-Type": "application/json", ...extra };
}

/** Turn an in-memory attachment into a Helix message part (base64 data URL, inline). */
export function attachmentPart(a: HelixAttachment): HelixPart {
  const dataUrl = `data:${a.mediaType};base64,${Buffer.from(a.bytes).toString("base64")}`;
  if (a.mediaType.startsWith("image/")) {
    return { type: "image_url", image_url: { url: dataUrl } };
  }
  return { type: "file", file: { filename: a.filename, file_data: dataUrl } };
}

/**
 * Send one blocking chat turn.
 * - With sessionId: continues that session (session keeps its bot configuration).
 * - With app keys, omit sessionId: the gateway creates a new session for the bot
 *   and returns its id in `sessionId` (store it and reuse it for the next turn).
 */
export async function sendTurn(opts: {
  sessionId?: string;
  message: string;
  attachments?: HelixAttachment[];
  timeoutMs?: number;
}): Promise<HelixTurn> {
  const parts: HelixPart[] = [];
  if (opts.attachments?.length) {
    parts.push({ type: "text", text: opts.message });
    for (const a of opts.attachments) parts.push(attachmentPart(a));
  } else {
    parts.push({ type: "text", text: opts.message });
  }

  const body: Record<string, unknown> = {
    stream: false,
    type: "text",
    messages: [
      {
        role: "user",
        content: { content_type: "text", parts },
      },
    ],
  };
  if (opts.sessionId) body.session_id = opts.sessionId;
  if (BOT_APP_ID) body.app_id = BOT_APP_ID;

  const res = await fetch(`${HELIX_URL}/api/v1/sessions/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 240_000),
  });
  if (!res.ok) {
    throw new Error(`Helix /sessions/chat failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    id: string;
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  return { sessionId: json.id, raw, reply: extractReply(raw) };
}

/**
 * The raw turn blob contains thinking + tool calls + the final answer. The
 * user-visible reply is the text after the turn's LAST tool-call block - the
 * same cut the Helix CLI uses.
 */
export function extractReply(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const marker = "**Tool Call: ";
  const i = text.lastIndexOf(marker);
  if (i >= 0) text = text.slice(i);
  const paragraphs = text.split(/\n\s*\n/);
  return (paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : text).trim();
}

export type HelixInteraction = {
  id: string;
  created: string;
  completed?: string;
  state: string;
  prompt: string;
};

/** Recent turns for a session (org API key required). */
export async function listInteractions(sessionId: string, perPage = 10): Promise<HelixInteraction[]> {
  const res = await fetch(
    `${HELIX_URL}/api/v1/sessions/${sessionId}/interactions?per_page=${perPage}&order=desc&page=0`,
    { headers: authHeaders(), signal: AbortSignal.timeout(20_000) },
  );
  if (!res.ok) throw new Error(`Helix interactions failed: ${res.status}`);
  const json = (await res.json()) as { interactions?: HelixInteraction[] };
  return json.interactions ?? [];
}

/** Per-session usage: tokens, prompt-cache hit ratio, cost, latency percentiles. */
export async function getUsage(sessionId: string): Promise<unknown> {
  const res = await fetch(`${HELIX_URL}/api/v1/sessions/${sessionId}/usage`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Helix usage failed: ${res.status}`);
  return res.json();
}

export async function getSession(sessionId: string): Promise<unknown> {
  const res = await fetch(`${HELIX_URL}/api/v1/sessions/${sessionId}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Helix get session failed: ${res.status}`);
  return res.json();
}

/** A bot instance keeps its sandbox warm; resume an idle-stopped one. */
export async function resumeSession(sessionId: string): Promise<boolean> {
  const res = await fetch(`${HELIX_URL}/api/v1/sessions/${sessionId}/resume`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  return res.ok;
}
