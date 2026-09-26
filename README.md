# Helix Webchat Demo

A sample 3rd-party app that integrates a **Helix** customer-support bot with a web chat:
WhatsApp Web-style UI (Next.js + TypeScript + shadcn/ui + the Vercel AI SDK), file uploads that
land in the bot's workspace, and a live activity panel for the underlying Helix session.

The browser never talks to Helix directly — your Next.js backend holds the API key and proxies
every request. Full HTTP reference: **[docs/api.md](docs/api.md)**.

```
┌────────────┐   POST /api/chat (AI SDK stream)   ┌─────────────┐   POST /api/v1/sessions/chat   ┌────────────────┐
│  Browser    │ ────────────────────────────────▶ │  Next.js    │ ─────────────────────────────▶ │  Helix API     │
│  (useChat)  │ ◀──────────────────────────────── │  backend    │ ◀───────────────────────────── │  bot instance  │
└────────────┘    X-Helix-Session: ses_…          └─────────────┘   Bearer <app/org key>          └────────────────┘
        │                                       GET /api/activity ──▶ GET /sessions/{id}/interactions, /usage
        └── 📎 files → base64 data URLs (inline) ──▶ Helix message parts ──▶ bot sandbox ~/work/incoming/
```

**Verified against a live Helix API**: first message on a fresh session (bot instance created by
the gateway) answers in ~5 s; warm page-read questions answer in ~3 s; attached files show up in
the bot's `~/work/incoming/` and are read by the bot.

## What's in the box

- **WhatsApp Web-style UI** — contact list with fake contacts + one **live** contact ("Helix
  Support") wired to a real bot session, message bubbles with ticks and times, typing
  indicator, emoji-free clean dark theme, 📎 file picker (images, PDFs, Office, CSV/TXT).
- **`/api/chat`** — server route: takes the Vercel AI SDK's UI messages, forwards the last user
  turn (text + inline base64 attachments) to `POST /api/v1/sessions/chat`, streams the reply
  back as a UI message stream, returns the Helix session id in `X-Helix-Session`.
- **`/api/activity`** — session activity (recent turns, tool calls, token/cost/latency usage)
  fetched from `GET /sessions/{id}/interactions` and `GET /sessions/{id}/usage`.
- **`bot/`** — the customer-support bot spec (`bot.yaml` + prompt) to apply in your org.
- **`docs/api.md`** — the HTTP API integration guide (auth keys, chat, attachments, sessions,
  activity, error handling) — everything here was verified against a live API.
- **`docs/portal-connection.md`** — the separate mock portal credential handoff API and
  a safe path for adding a Connect portal action outside chat messages.

## Setup

### 1. Deploy the demo bot into your Helix org

```bash
export HELIX_URL=https://<your-helix-host>   # e.g. http://100.108.100.25:8080
export HELIX_API_KEY=hl-…                    # your org API key
export HELIX_ORG=<your-org>

helix org bots apply -f bot/bot.yaml         # idempotent: creates/updates b-support-demo
```

Grab the ids you'll need:

```bash
helix org bots list                          # → app id (app_01m3…) for HELIX_BOT_APP_ID
helix org bots appkey b-support-demo create demo-backend   # → optional app-scoped key
```

### 2. Run the app

**Docker (recommended for demos):**

```bash
cp .env.example .env.local                   # fill in HELIX_URL, HELIX_API_KEY, HELIX_BOT_APP_ID
docker compose up -d --build                 # http://localhost:3111
```

**Or plain Node:**

```bash
npm install
cp .env.example .env.local                   # fill in HELIX_URL, HELIX_API_KEY, HELIX_BOT_APP_ID
npm run dev                                  # http://localhost:3000
```

Open the app, type into the **Helix Support** chat (the only *live* contact — the others are
static demo data), attach a file with 📎, and open **⚡ Activity** in the chat header to see the
Helix session's turns and usage.

### 3. Environment

| Variable | Required | What it is |
|---|---|---|
| `HELIX_URL` | ✅ | Base URL of your Helix API (no trailing slash). |
| `HELIX_API_KEY` | ✅ | Org API key — server-side only. Chat + activity reads. |
| `HELIX_BOT_APP_ID` | ✅ | The bot's app id (`app_…`); used with the org key to start sessions and recorded in chat bodies. |
| `HELIX_APP_API_KEY` | ⬜ | Production alternative: chat with the bot's **app key** (gateway scope). See docs/api.md. |

**Security**: keys live only in the Next.js server routes (`/api/*`). The browser gets session
ids, never keys.

## APIs used (summary)

| Purpose | Endpoint (server-side) |
|---|---|
| Chat turn (blocking, with attachments) | `POST /api/v1/sessions/chat` |
| Session record | `GET /api/v1/sessions/{id}` |
| Recent turns (activity) | `GET /api/v1/sessions/{id}/interactions` |
| Tokens / cache / cost / latency | `GET /api/v1/sessions/{id}/usage` |
| Wake an idle-stopped instance | `POST /api/v1/sessions/{id}/resume` |

Details, exact payloads and the app-key-vs-org-key model: **[docs/api.md](docs/api.md)**.

## How the pieces fit

- **`src/lib/helix.ts`** — the whole Helix client (sendTurn, attachments, interactions, usage,
  resume, reply extraction). Port this file first when you adapt the demo.
- **`src/app/api/chat/route.ts`** — the gateway proxy: AI SDK messages in → Helix turn →
  UI-message stream out + `X-Helix-Session` header. One Helix session per conversation; the
  browser stores `sessionId` per contact and sends it back on every turn.
- **`src/components/chat-app.tsx`** — the UI. Swap `src/lib/contacts.ts` for your real contact
  list and you have a support inbox.

## Notes from the field (built while dogfooding the API)

- **Sessions are the tenant boundary** — one Helix session per customer conversation; the bot
  keeps its configuration per session, and the app key can chat in any instance of its bot.
- **Attachments are data URLs** and land in the agent sandbox at `~/work/incoming/` — bots should
  read them like local files (see `bot/prompt.md`).
- **Idle sandboxes** stop after ~10 minutes; the next chat turn restarts them (slower first
  turn), or `POST /sessions/{id}/resume` preempts it.
- **The raw turn blob** contains `<thinking>` blocks and `**Tool Call:` sections — cut the reply
  after the last tool call (implemented in `src/lib/helix.ts`, matching the Helix CLI).
- **OTP-style interactive flows** (bots driving web portals) need the bot's own skill/runbook —
  this demo's bot is deliberately simple.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the build
```
