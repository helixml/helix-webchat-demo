# Helix HTTP API — integrating 3rd-party apps

Everything a backend needs to drive a Helix **bot** (org agent) from an external app:
create sessions, chat with file attachments, read per-session activity, and keep idle
instances alive. All shapes below were verified against a live Helix API (`helixml/helix`,
`POST /api/v1/...`).

## Base & auth

```
HELIX_URL=https://<your-helix-host>        # e.g. http://100.108.100.25:8080
```

Every request authenticates with a Bearer key:

```
Authorization: Bearer <key>
Content-Type: application/json
```

Two key types exist:

| Key | Scope | Chat | Read interactions/usage |
|---|---|---|---|
| **Org API key** (`hl-…`) | the whole org | ✅ any session | ✅ |
| **Bot app key** (`hl-…`) | one bot only | ✅ any session of that bot | ❌ chat-only |

Get them:
- org key: Helix UI → your account page, or `HELIX_API_KEY` env var you already use with the CLI.
- bot app key: `helix org bots appkey <bot-id> create <name>` (list/delete with `list` / `delete <key>`).

**Production rule of thumb:** the backend chats with a bot's *app key* (gateway scope — the key
can only reach `/sessions/chat` and `/v1/chat/completions`), and keeps the *org key* server-side
only if it also needs activity reads. The session id is the only tenant boundary.

---

## 1. Chat — `POST /api/v1/sessions/chat`

One blocking turn. This is the endpoint this demo's `/api/chat` route wraps.

### Start a conversation (new session)

With an **app key**, omit `session_id` — the gateway creates a new bot instance and session:

```jsonc
POST /api/v1/sessions/chat
Authorization: Bearer <app-key>

{
  "stream": false,
  "type": "text",
  "app_id": "app_01m3ec75h9ckfsyn0spph7jg6p",   // your bot's app id (helix org bots list)
  "messages": [
    {
      "role": "user",
      "content": {
        "content_type": "text",
        "parts": ["Hi — I manage Accelerando. When does my licence expire?"]
      }
    }
  ]
}
```

Response (blocking — the turn has already run to completion):

```jsonc
{
  "id": "ses_01m3ec89xq1z17p8h2pecays6c",        // ← store this; it IS the conversation
  "choices": [
    { "message": { "content": "<turn blob>" } }  // thinking + tool calls + final reply
  ]
}
```

`content` is the **raw turn blob**. The user-visible reply is the text after the turn's last
tool-call block — cut it the way the Helix CLI does (see `extractReply` in
`src/lib/helix.ts`): strip `<thinking>…</thinking>`, cut at the last `**Tool Call: `, take the
last non-empty paragraph.

With an **org key**, either:
- pass `"session_id": "ses_…"` to continue any session, or
- pass `"app_id"` the same way to start one.

**Tenant tip:** keep one Helix session per end-user conversation — that's the isolation
boundary. Store `sessionId` per chat and reuse it on every turn.

### Continue a conversation

```jsonc
{
  "stream": false,
  "type": "text",
  "session_id": "ses_01m3ec89xq1z17p8h2pecays6c",
  "messages": [ { "role": "user", "content": { "content_type": "text", "parts": ["and my visa?"] } } ]
}
```

Timings we measured on a warm bot session: a page-read answer takes ~3 s wall; a fresh
session's first turn includes the sandbox boot (~30–60 s). Set your HTTP timeout accordingly
(the CLI default is 900 s; this demo uses 240 s).

### Send files (attachments)

Attachments are **inline base64 data: URLs** in the message parts. They land in the agent's
sandbox at `~/work/incoming/`, where the bot reads them like any local file.

```jsonc
// images:
{ "type": "image_url", "image_url": { "url": "data:image/png;base64,…" } }

// everything else (pdf, txt, xlsx, docx, …):
{ "type": "file", "file": { "filename": "invoice.pdf", "file_data": "data:application/pdf;base64,…" } }
```

A full turn with one text part + two attachments:

```jsonc
{
  "stream": false,
  "type": "text",
  "session_id": "ses_…",
  "messages": [
    {
      "role": "user",
      "content": {
        "content_type": "text",
        "parts": [
          { "type": "text", "text": "Check the attached invoice and tell me the total." },
          { "type": "file", "file": { "filename": "invoice.pdf",
                                      "file_data": "data:application/pdf;base64,JVBERi0x…" } },
          { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0…" } }
        ]
      }
    }
  ]
}
```

Keep attachments small (a few MB); base64 inflates payloads by ~33%.

### Streaming

`"stream": true` returns an SSE stream instead of the blocking JSON. This demo keeps the
gateway blocking and streams the final reply to the browser itself (chunked), which is simpler
and keeps the Helix session state machine intact.

---

## 2. Session lifecycle

| Endpoint | Method | Notes |
|---|---|---|
| `/api/v1/sessions/{id}` | GET | Session record (org key). |
| `/api/v1/sessions?org_id=<org>&page=&page_size=` | GET | Paginated list (org key). |
| `/api/v1/sessions/{id}/resume` | POST | Wake an idle-stopped instance sandbox. Bot instance sandboxes stop after ~10 min idle; the next chat usually restarts them, but an explicit resume avoids a cold first turn. |
| `/api/v1/sessions/{id}/stop-external-agent` | DELETE | Stop a desktop/external-agent session. |

The first chat turn on a fresh session boots the sandbox. If the UI must stay snappy, "warm"
the conversation by sending a cheap first turn (or resume) when the customer opens the chat.

---

## 3. Activity — turns, tool calls, usage (org key)

### Turns & tool calls — `GET /api/v1/sessions/{id}/interactions`

```
GET /api/v1/sessions/ses_…/interactions?per_page=10&order=desc&page=0
→ { "interactions": [ { "id", "created", "completed", "state",
                        "prompt_message", … } ] }
```

Each interaction is one turn. Tool calls and per-entry text are embedded in the interaction
content; the demo's Activity panel shows turn time, state and the prompt.

### Usage & cost — `GET /api/v1/sessions/{id}/usage`

```
→ { llm_calls, prompt_tokens, completion_tokens, cache_read_tokens,
    cache_hit_ratio, cost, llm_time, ttft_p50/p90, call_duration_p50/p90, … }
```

Per-turn and per-call breakdowns are in the same payload (see helixml/helix
`GET /sessions/{id}/usage`, types.SessionUsage). The demo shows tokens, cache hit, cost and
LLM time in the Activity sheet.

---

## 4. Admin — creating/updating bots from an app (optional)

Bots are usually managed with the CLI (`helix org bots apply -f bot.yaml`), but the same REST
surface is available: `POST /api/v1/orgs/{org}/agents` (see helixml/helix `api/pkg/client`).
For this demo the repo ships `bot/bot.yaml` + `bot/prompt.md` — apply them with the CLI.

---

## 5. Error handling checklist

- **401** — wrong/missing key, or an app key used on a read endpoint.
- **Timeout** — turns can run long (tool-using bots); use ≥ 240 s for chat, and keep the UI
  "typing" state while waiting.
- **Sandbox cold start** — after idle-stop, the first turn is slower; call `/resume` if you
  need predictable latency.
- **Attachment too large** — prefer chunked data URLs per message and keep files ≤ a few MB.
- **Session-per-conversation** — never share one Helix session across customers.
