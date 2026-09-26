"use client";

import { useChat, Chat as AiChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  IconChats, IconCalls, IconStatus, IconChannels, IconCommunities, IconFilter,
  IconPlus, IconSearch, IconMore, IconSticker, IconMic, IconVideo, IconLock, IconSend,
  IconArchive, IconDelivered, IconRead, IconTailIn, IconChevronDown, IconClose, IconChevronDownWide,
} from "@/components/wa-icons";
import { CONTACTS, FAKE_HISTORIES, initials, type FakeMessage } from "@/lib/contacts";

// ─── tokens extracted from the live WhatsApp Web (dark) ─────────────────────
const C = {
  appBg: "#1d1f1f",
  railBg: "#1d1f1f",
  listBg: "#161717",
  chatBg: "#0b141a",
  headerBg: "#161717",
  hoverBg: "#202c33",
  activeBg: "#2a3942",
  searchBg: "rgba(255,255,255,0.1)",
  chipUnselected: "#1f2c33",
  chipSelected: "#103529",
  chipSelectedText: "#d9fdd3",
  bannerBg: "#144d37",
  textPrimary: "#e9edef",
  textBright: "#fafafa",
  textMuted: "#8696a0",
  icon: "#aebac1",
  green: "#21c063",
  greenBright: "#25d366",
  bubbleIn: "#242626",
  bubbleOut: "#005c4b",
  tickBlue: "#53bdeb",
  tickGray: "#8696a0",
  border: "rgba(255,255,255,0.1)",
  metaTime: "rgba(233,237,239,0.6)",
};
const FONT = 'var(--font-roboto), Roboto, "Helvetica Neue", Helvetica, sans-serif';

type ActivityTurn = { id: string; created: string; state: string; prompt: string };
type ActivityUsage = { total_tokens?: number; cost?: number; cache_hit?: number; llm_time?: number };
type ActivityData = {
  turns: ActivityTurn[];
  usage: ActivityUsage | null;
  session: { id?: string } | null;
};

function timeOf(message: UIMessage, seen: Map<string, string>) {
  if (!seen.has(message.id)) seen.set(message.id, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  return seen.get(message.id)!;
}

function Tick({ read }: { read?: boolean }) {
  return read ? <IconRead size={16} className="shrink-0" style={{ color: C.tickBlue }} /> : <IconDelivered size={16} className="shrink-0" style={{ color: C.tickGray }} />;
}

function Bubble({ message, seenTimes }: { message: UIMessage; seenTimes: Map<string, string> }) {
  const isUser = message.role === "user";
  const time = timeOf(message, seenTimes);
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-[3%]`}>
      <div
        className="relative my-[2px] py-1.5"
        style={{
          maxWidth: "65%",
          backgroundColor: isUser ? C.bubbleOut : C.bubbleIn,
          borderRadius: "7.5px",
          borderTopRightRadius: isUser ? 0 : undefined,
          borderTopLeftRadius: isUser ? undefined : 0,
          color: C.textBright,
          fontSize: "14.2px",
          lineHeight: "19px",
          boxShadow: "0 1px .5px rgba(11,20,26,.13)",
        }}
      >
        {!isUser && (
          <span className="absolute -left-2 top-0 block h-[13px] w-2" style={{ color: isUser ? C.bubbleOut : C.bubbleIn }}>
            <IconTailIn size={13} className="[transform:none]" />
          </span>
        )}
        <div className="mx-2 space-y-1 whitespace-pre-wrap break-words">
          {message.parts.map((part, i) => {
            if (part.type === "text" && part.text) return <p key={i}>{part.text}</p>;
            if (part.type === "file") {
              if (part.mediaType?.startsWith("image/")) {
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={part.url} alt={part.filename ?? "image"} className="max-h-72 rounded-[6px]" />
                );
              }
              return (
                <a
                  key={i}
                  href={part.url}
                  download={part.filename ?? "file"}
                  className="flex items-center gap-3 rounded-md bg-black/10 px-3 py-2 hover:bg-black/20 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "#23b7a4" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5Z" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm" style={{ color: C.textPrimary }}>{part.filename ?? "attachment"}</span>
                    <span className="text-xs" style={{ color: C.textMuted }}>{part.mediaType || "file"}</span>
                  </span>
                </a>
              );
            }
            return null;
          })}
        </div>
        <div className="float-right ml-2 mt-1 flex translate-y-1 items-center gap-1 text-[11px]" style={{ color: C.metaTime }}>
          {time}
          {isUser && <Tick read />}
        </div>
        <div className="clear-both" />
      </div>
    </div>
  );
}

function ActivitySheet({ open, onOpenChange, sessionId }: { open: boolean; onOpenChange: (o: boolean) => void; sessionId: string | null }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    setData(null);
    setError(null);
    fetch(`/api/activity?sessionId=${encodeURIComponent(sessionId)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch((e: unknown) => setError(String(e)));
  }, [open, sessionId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] overflow-y-auto border-l sm:w-[440px]" style={{ background: "#1f2c33", borderColor: C.border }}>
        <SheetHeader>
          <SheetTitle style={{ color: C.textPrimary }}>Session activity</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8 text-sm">
          {!sessionId && <p style={{ color: C.textMuted }}>No Helix session yet — send a message first.</p>}
          {error && <p className="text-red-400">{error}</p>}
          {data && (
            <>
              {data.session?.id && (
                <div className="rounded-lg p-3" style={{ background: "#111b21" }}>
                  <div className="mb-1 text-xs" style={{ color: C.textMuted }}>Helix session</div>
                  <div className="break-all font-mono text-[11px]" style={{ color: C.textPrimary }}>{data.session.id}</div>
                </div>
              )}
              {data.usage && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Total tokens", data.usage.total_tokens ?? "—"],
                    ["Cache hit", data.usage.cache_hit ? `${Math.round((data.usage.cache_hit as number) * 100)}%` : "—"],
                    ["Cost", typeof data.usage.cost === "number" ? `$${data.usage.cost.toFixed(4)}` : "—"],
                    ["LLM time", data.usage.llm_time ? `${Math.round(data.usage.llm_time as number)}s` : "—"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg p-3" style={{ background: "#111b21" }}>
                      <div className="text-xs" style={{ color: C.textMuted }}>{label}</div>
                      <div className="font-medium" style={{ color: C.textPrimary }}>{String(value)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 text-sm font-medium" style={{ color: C.textPrimary }}>Recent turns</div>
              {data.turns.length === 0 && <p style={{ color: C.textMuted }}>No turns recorded yet.</p>}
              <div className="space-y-2">
                {data.turns.map((t) => (
                  <div key={t.id} className="rounded-lg border p-3" style={{ background: "#111b21", borderColor: C.border }}>
                    <div className="flex items-center justify-between text-xs" style={{ color: C.textMuted }}>
                      <span>{new Date(t.created).toLocaleTimeString()}</span>
                      <span>{t.state}</span>
                    </div>
                    <div className="mt-1 line-clamp-2" style={{ color: C.textPrimary }}>{t.prompt || <em>(empty)</em>}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ChatApp() {
  const [activeId, setActiveId] = useState("support");
  const [draft, setDraft] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenTimes = useRef(new Map<string, string>());
  const sessionId = sessionIds["support"] ?? null;
  sessionIdRef.current = sessionId;

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: () => ({ sessionId: sessionIdRef.current }) }),
    [],
  );
  const chat = useMemo(() => new AiChat({ transport }), [transport]);
  const { messages, sendMessage, status } = useChat({ chat });

  useEffect(() => {
    const last = messages[messages.length - 1];
    const dataPart = last?.parts.find((p) => p.type === "data-session") as { data?: { sessionId?: string } } | undefined;
    const sid = dataPart?.data?.sessionId;
    if (sid) setSessionIds((s) => (s["support"] === sid ? s : { ...s, ["support"]: sid }));
  }, [messages, sessionIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const active = CONTACTS.find((c) => c.id === activeId) ?? CONTACTS[0];
  const isLive = active.id === "support";
  const fakeHistory: FakeMessage[] = FAKE_HISTORIES[active.id] ?? [];
  const busy = status === "submitted" || status === "streaming";
  const livePreview =
    (messages[messages.length - 1]?.parts.find((p) => p.type === "text") as { text?: string })?.text ??
    "Describe your issue or attach a file…";

  const send = async () => {
    const text = draft.trim();
    if ((!text && pickedFiles.length === 0) || busy || !isLive) return;
    const parts = await Promise.all(
      pickedFiles.map(async (f) => ({
        type: "file" as const,
        mediaType: f.type || "application/octet-stream",
        filename: f.name,
        url: await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(f);
        }),
      })),
    );
    setDraft("");
    setPickedFiles([]);
    await sendMessage({ text: text || (parts.length ? "See attachment" : ""), files: parts });
  };

  const rail = [
    { icon: <IconChats size={24} />, label: "Chats", active: true, badge: 1 },
    { icon: <IconCalls size={24} />, label: "Calls" },
    { icon: <IconStatus size={24} />, label: "Status", dot: true },
    { icon: <IconChannels size={24} />, label: "Channels" },
    { icon: <IconCommunities size={24} />, label: "Communities" },
  ];

  return (
    <div className="flex h-dvh w-full" style={{ background: C.appBg, fontFamily: FONT }}>
      {/* left nav rail */}
      <nav className="flex h-full w-16 shrink-0 flex-col items-center justify-between py-2.5" style={{ background: C.railBg, padding: "10px 12px" }}>
        <div className="flex flex-col items-center gap-1">
          {rail.map((r) => (
            <button key={r.label} title={r.label} className="relative grid h-10 w-10 place-items-center rounded-full" style={{ color: r.active ? "#f7f8fa" : C.icon }}>
              {r.icon}
              {r.badge ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-medium" style={{ background: C.green, color: "#111b21" }}>
                  {r.badge}
                </span>
              ) : null}
              {r.dot ? (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: C.railBg, background: C.green }} />
              ) : null}
            </button>
          ))}
          <button title="Meta AI" className="grid h-10 w-10 place-items-center rounded-full">
            <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: "conic-gradient(from 0deg, #4e73f6, #9b59f6, #ff5f8f, #4e73f6)" }}>
              <span className="h-3 w-3 rounded-full" style={{ background: C.railBg }} />
            </span>
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button title="Filter unread" className="grid h-10 w-10 place-items-center rounded-full" style={{ color: C.icon }}>
            <IconFilter size={24} />
          </button>
          <button title="Profile" className="grid h-10 w-10 place-items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-medium" style={{ background: "#dfdedb", color: "#3b4a54" }}>
              KR
            </span>
          </button>
        </div>
      </nav>

      {/* chat list panel */}
      <aside className="flex h-full w-[512px] shrink-0 flex-col border-r" style={{ background: C.listBg, borderColor: C.border }}>
        <header className="flex h-[60px] items-center justify-between px-5">
          <span className="text-[22px] font-medium" style={{ color: C.textBright }}>WhatsApp</span>
          <div className="flex items-center gap-1">
            <button className="grid h-10 w-10 place-items-center rounded-full" style={{ color: C.textMuted }} title="Menu">
              <IconMore size={22} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.green }} title="New chat">
              <IconPlus size={22} className="dark:text-[#111b21]" style={{ color: "#0b141a" }} />
            </button>
          </div>
        </header>

        {/* search */}
        <div className="px-3 pb-2">
          <div className="flex h-10 items-center gap-3 px-4" style={{ background: C.searchBg, borderRadius: "1000px" }}>
            <IconSearch size={20} style={{ color: C.textMuted }} />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#8696a0]"
              placeholder="Search or start a new chat"
              style={{ color: C.textPrimary }}
            />
          </div>
        </div>

        {/* filter chips */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <button className="h-8 rounded-full px-3 text-[13px]" style={{ background: C.chipSelected, color: C.chipSelectedText }}>All</button>
          <button className="h-8 rounded-full px-3 text-[13px]" style={{ background: C.chipUnselected, color: C.textMuted }}>Unread <span className="ml-0.5">2</span></button>
          <button className="h-8 rounded-full px-3 text-[13px]" style={{ background: C.chipUnselected, color: C.textMuted }}>Favourites</button>
          <button className="h-8 rounded-full px-3 text-[13px]" style={{ background: C.chipUnselected, color: C.textMuted }}>Groups <span className="ml-0.5">1</span></button>
          <button className="grid h-8 w-8 place-items-center rounded-full" style={{ background: C.chipUnselected, color: C.textMuted }}>
            <IconChevronDownWide size={16} />
          </button>
        </div>

        {/* banner */}
        <div className="mx-3 mb-1 flex h-[52px] items-center gap-3 rounded-lg px-3" style={{ background: C.bannerBg }}>
          <span style={{ color: "#d9fdd3" }}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-4.95-11.36 8.31 8.31-1.41 1.41-8.31-8.31 1.41-1.41Z" /></svg></span>
          <span className="flex-1 text-sm" style={{ color: "#d9fdd3" }}>
            Message and call notifications are off. <span className="cursor-pointer font-medium" style={{ color: "#21c063" }}>Turn on</span>
          </span>
          <button style={{ color: "#d9fdd3" }}><IconClose size={20} /></button>
        </div>

        {/* archived */}
        <button className="flex h-[52px] items-center gap-5 px-6 text-left" style={{ color: C.textMuted }}>
          <IconArchive size={22} />
          <span className="text-[15px]">Archived</span>
        </button>
        <div className="mx-4 border-b" style={{ borderColor: "rgba(134,150,160,0.15)" }} />

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {CONTACTS.map((c) => {
            const isActive = activeId === c.id;
            const preview = c.live ? livePreview : FAKE_HISTORIES[c.id]?.slice(-1)[0]?.text ?? "";
            const time = c.live ? (messages.length ? timeOf(messages[messages.length - 1], seenTimes.current) : "") : c.lastSeen;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className="flex h-[76px] w-full items-center gap-[15px] px-3 text-left hover:bg-[#202c33]"
                style={isActive ? { background: C.activeBg } : undefined}
              >
                <span
                  className="grid h-[49px] w-[49px] shrink-0 place-items-center rounded-full text-sm font-medium"
                  style={{ background: c.color, color: "#fff" }}
                >
                  {c.live ? "HS" : initials(c.name)}
                </span>
                <span className="min-w-0 flex-1 border-b pb-3" style={{ borderColor: "rgba(134,150,160,0.15)" }}>
                  <span className="flex items-center justify-between">
                    <span className="truncate text-[17px] leading-6" style={{ color: C.textPrimary }}>{c.name}</span>
                    <span className={`shrink-0 pl-2 text-xs ${c.unread || c.live ? "" : ""}`} style={{ color: c.unread ? C.greenBright : C.textMuted }}>
                      {time}
                    </span>
                  </span>
                  <span className="flex items-center justify-between pt-1">
                    <span className="truncate text-sm leading-5" style={{ color: C.textMuted }}>{preview}</span>
                    {c.unread ? (
                      <Badge className="ml-2 h-[19px] min-w-[19px] shrink-0 rounded-full px-[7px] text-[12px] font-medium" style={{ background: C.green, color: "#111b21" }}>
                        {c.unread}
                      </Badge>
                    ) : c.live ? (
                      <Badge variant="outline" className="ml-2 h-[19px] shrink-0 rounded-full px-2 text-[11px]" style={{ borderColor: C.green, color: C.green }}>
                        live
                      </Badge>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* conversation */}
      <main className="relative hidden flex-1 flex-col md:flex" style={{ background: C.chatBg }}>
        <header className="z-10 flex h-16 items-center justify-between px-4" style={{ background: C.headerBg }}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-medium" style={{ background: active.color, color: "#fff" }}>
              {isLive ? "HS" : initials(active.name)}
            </span>
            <div>
              <div className="text-[16px] leading-5" style={{ color: C.textPrimary }}>{active.name}</div>
              <div className="text-[13px]" style={{ color: C.textMuted }}>{busy && isLive ? "typing…" : isLive ? "online" : "last seen recently"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ color: C.icon }}>
            {isLive && (
              <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#365063]/60" title="Session activity" onClick={() => setShowActivity(true)}>
                <span className="text-lg">⚡</span>
              </button>
            )}
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#365063]/60" title="Video call"><IconVideo size={22} /></button>
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#365063]/60" title="Search"><IconSearch size={22} /></button>
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#365063]/60" title="Menu"><IconMore size={22} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' fill='none' stroke='%23ffffff' stroke-opacity='0.025'%3E%3Ccircle cx='40' cy='40' r='12'/%3E%3Cpath d='M120 30c10 0 20 10 20 20M200 60l20 20M60 200c20 0 30-10 30-30M160 150c15-15 35-5 35 10'/%3E%3Ccircle cx='220' cy='220' r='8'/%3E%3Cpath d='M20 120h30M230 130c0 10-8 18-18 18'/%3E%3C/svg%3E\")" }}>
          {!isLive && (
            <>
              <div className="mx-auto my-4 w-fit rounded-lg px-3 py-1.5 text-center text-[12.5px] uppercase tracking-wide" style={{ background: "#182229", color: C.textMuted }}>
                {fakeHistory.length ? "Yesterday" : ""}
              </div>
              {fakeHistory.map((m, i) => (
                <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} px-[3%]`}>
                  <div
                    className="relative my-[2px] py-1.5"
                    style={{
                      maxWidth: "65%",
                      backgroundColor: m.from === "me" ? C.bubbleOut : C.bubbleIn,
                      borderRadius: "7.5px",
                      borderTopRightRadius: m.from === "me" ? 0 : undefined,
                      borderTopLeftRadius: m.from === "me" ? undefined : 0,
                      color: C.textBright,
                      fontSize: "14.2px",
                      boxShadow: "0 1px .5px rgba(11,20,26,.13)",
                    }}
                  >
                    <div className="mx-2 whitespace-pre-wrap">{m.text}</div>
                    <div className="float-right ml-2 mt-1 translate-y-1 text-[11px]" style={{ color: C.metaTime }}>
                      {m.time}
                      {m.from === "me" && <Tick />}
                    </div>
                    <div className="clear-both" />
                  </div>
                </div>
              ))}
            </>
          )}

          {isLive && (
            <>
              <div className="mx-auto my-4 w-fit rounded-lg px-3 py-1.5 text-center text-[12.5px] uppercase tracking-wide" style={{ background: "#182229", color: C.textMuted }}>
                Today
              </div>
              <div className="flex justify-center pb-2">
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-center text-[12.5px]" style={{ background: "#182229", color: C.textMuted }}>
                  <IconLock size={14} />
                  This demo streams one Helix bot session per conversation through your backend.
                </div>
              </div>
              {messages.map((m) => (
                <Bubble key={m.id} message={m} seenTimes={seenTimes.current} />
              ))}
              {busy && (
                <div className="flex justify-start px-[3%]">
                  <div className="relative py-1.5" style={{ background: C.bubbleIn, borderRadius: "7.5px", borderTopLeftRadius: 0 }}>
                    <span className="absolute -left-2 top-0 block h-[13px] w-2" style={{ color: C.bubbleIn }}><IconTailIn size={13} /></span>
                    <span className="mx-3 flex gap-1 py-1">
                      <span className="h-2 w-2 animate-bounce rounded-full opacity-50" style={{ background: "#8696a0", animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full opacity-50" style={{ background: "#8696a0", animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full opacity-50" style={{ background: "#8696a0", animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* scroll-to-bottom */}
        <button className="absolute bottom-[84px] right-5 grid h-10 w-10 place-items-center rounded-full shadow-lg" style={{ background: C.hoverBg, color: C.icon }}>
          <IconChevronDown size={22} />
        </button>

        {/* composer */}
        <footer className="relative z-10 px-3 pb-3" style={{ background: C.chatBg }}>
          {pickedFiles.length > 0 && (
            <div className="absolute -top-16 left-3 right-3 flex gap-2 overflow-x-auto rounded-lg bg-[#233138] p-2 shadow-md">
              {pickedFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-2 rounded-full bg-[#111b21] px-3 py-1.5 text-xs" style={{ color: C.textPrimary }}>
                  📎 {f.name.length > 22 ? `${f.name.slice(0, 22)}…` : f.name}
                  <button className="opacity-60 hover:opacity-100" onClick={() => setPickedFiles((p) => p.filter((_, j) => j !== i))}>
                    <IconClose size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,application/pdf,.txt,.csv,.xlsx,.docx" onChange={(e) => { if (e.target.files) setPickedFiles((p) => [...p, ...Array.from(e.target.files!)]); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
          <form
            className="flex h-[52px] items-center gap-1 rounded-[26px] px-1.5"
            style={{ background: C.bubbleIn, padding: 5, boxShadow: "rgba(0,0,0,0.12) 0px 1px 6px 0px" }}
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color: C.textMuted }} title="Attach" disabled={!isLive} onClick={() => fileInputRef.current?.click()}>
              <IconPlus size={24} />
            </button>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color: C.textMuted }} title="Emojis, GIFs, Stickers" disabled={!isLive}>
              <IconSticker size={24} />
            </button>
            <input
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-[#8696a0]"
              placeholder="Type a message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              enterKeyHint="send"
              style={{ color: C.textBright }}
              disabled={!isLive}
            />
            <button
              type="submit"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              title="Send"
              disabled={busy || !isLive}
              style={{ color: draft.trim() || pickedFiles.length ? C.green : C.textMuted }}
            >
              {busy ? <span className="text-sm">···</span> : draft.trim() || pickedFiles.length ? <IconSend size={24} /> : <IconMic size={24} />}
            </button>
          </form>
        </footer>

        <ActivitySheet open={showActivity} onOpenChange={setShowActivity} sessionId={sessionId} />
      </main>
    </div>
  );
}
