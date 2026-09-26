import { getSession, getUsage, listInteractions } from "@/lib/helix";

export const dynamic = "force-dynamic";

/**
 * Activity panel data for one Helix session:
 *   GET /api/activity?sessionId=ses_xxx
 * -> { session, turns: [{id, created, state, prompt}], usage }
 *
 * Interactions and usage need the org API key (a bot's app key can chat but
 * cannot read interactions), which is exactly why this lives on the backend.
 */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  const [session, turns, usage] = await Promise.allSettled([
    getSession(sessionId),
    listInteractions(sessionId, 10),
    getUsage(sessionId),
  ]);

  return Response.json({
    session: session.status === "fulfilled" ? session.value : null,
    turns:
      turns.status === "fulfilled"
        ? turns.value.map((t) => ({
            id: t.id,
            created: t.created,
            state: t.state,
            prompt: t.prompt?.slice(0, 120),
          }))
        : [],
    usage: usage.status === "fulfilled" ? usage.value : null,
  });
}
