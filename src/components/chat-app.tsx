"use client";

import { useChat } from "@ai-sdk/react";
import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONTACTS, FAKE_HISTORIES, initials, type Contact, type FakeMessage } from "@/lib/contacts";

type ActivityTurn = { id: string; created: string; state: string; prompt: string };
type ActivityUsage = { total_tokens?: number; cost?: number; cache_hit?: number; llm_time?: number };
type ActivityData = {
  turns: ActivityTurn[];
  usage: ActivityUsage | null;
  session: { id?: string } | null;
};

const SUPPORT = CONTACTS[0];

const seenTimes = new Map<string, string>();
function timeOf(message: UIMessage) {
  if (!seenTimes.has(message.id)) {
    seenTimes.set(
      message.id,
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
  }
  return seenTimes.get(message.id)!;
}

function Bubble({ message, contactName }: { message: UIMessage; contactName: string }) {
  const isUser = message.role === "user";
  const time = timeOf(message);
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-6`}>
      <div
        className={`relative my-1 max-w-[65%] rounded-lg px-3 py-2 text-sm shadow-sm ${
          isUser
            ? "rounded-tr-none bg-[#d9fdd3] text-black dark:bg-[#005c4b] dark:text-white"
            : "rounded-tl-none bg-white text-black dark:bg-[#202c33] dark:text-gray-100"
        }`}
      >
        {!isUser && <div className="mb-0.5 text-xs font-medium text-[#00a884]">{contactName}</div>}
        <div className="space-y-1 whitespace-pre-wrap break-words">
          {message.parts.map((part, i) => {
            if (part.type === "text" && part.text) return <p key={i}>{part.text}</p>;
            if (part.type === "file") {
              const url = part.url;
              if (part.mediaType?.startsWith("image/")) {
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={part.filename ?? "image"} className="max-h-64 rounded-md" />
                );
              }
              return (
                <a
                  key={i}
                  href={url}
                  download={part.filename ?? "file"}
                  className="flex items-center gap-2 rounded-md bg-black/5 px-2 py-1.5 dark:bg-white/10"
                >
                  <span className="text-lg">📎</span>
                  <span className="underline">{part.filename ?? "attachment"}</span>
                </a>
              );
            }
            return null;
          })}
        </div>
        <div className="mt-0.5 text-right text-[10px] text-gray-500 dark:text-gray-400">
          {isUser && <span className="mr-0.5 text-[#53bdeb]">✓✓</span>}
          {time}
        </div>
      </div>
    </div>
  );
}

function ActivitySheet({
  open,
  onOpenChange,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
}) {
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
      <SheetContent className="w-[420px] overflow-y-auto sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Helix session activity</SheetTitle>
        </SheetHeader>
        {!sessionId && <p className="px-4 text-sm text-muted-foreground">No Helix session yet — send a message first.</p>}
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        {data && (
          <div className="space-y-4 px-4 pb-6">
            {data.session?.id && (
              <div className="rounded-lg bg-muted p-3 text-xs">
                <div className="font-semibold">Session</div>
                <div className="break-all font-mono text-[11px] text-muted-foreground">{data.session.id}</div>
              </div>
            )}
            {data.usage && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Total tokens</div>
                  <div className="font-semibold">{data.usage.total_tokens ?? "—"}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Cache hit</div>
                  <div className="font-semibold">{data.usage.cache_hit ? `${Math.round((data.usage.cache_hit as number) * 100)}%` : "—"}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="font-semibold">${typeof data.usage.cost === "number" ? data.usage.cost.toFixed(4) : "—"}</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">LLM time</div>
                  <div className="font-semibold">{data.usage.llm_time ? `${Math.round(data.usage.llm_time as number)}s` : "—"}</div>
                </div>
              </div>
            )}
            <Separator />
            <div className="text-sm font-semibold">Recent turns</div>
            {data.turns.length === 0 && <p className="text-sm text-muted-foreground">No turns recorded yet.</p>}
            <div className="space-y-2">
              {data.turns.map((t) => (
                <div key={t.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(t.created).toLocaleTimeString()}</span>
                    <Badge variant="secondary">{t.state}</Badge>
                  </div>
                  <div className="mt-1 line-clamp-2">{t.prompt || <em>(empty)</em>}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ChatApp() {
  const [activeId, setActiveId] = useState(SUPPORT.id);
  const [input, setInput] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});
  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = sessionIds[SUPPORT.id] ?? null;
  sessionIdRef.current = sessionId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ sessionId: sessionIdRef.current }),
      }),
    [],
  );

  // one Chat instance per conversation keeps histories separate
  const chat = useMemo(() => new Chat({ transport }), [transport]);
  const { messages, sendMessage, status } = useChat({ chat });

  // capture the Helix session id returned by the backend
  useEffect(() => {
    const last = messages[messages.length - 1];
    const dataPart = last?.parts.find((p) => p.type === "data-session") as
      | { type: "data-session"; data?: { sessionId?: string } }
      | undefined;
    const sid = dataPart?.data?.sessionId;
    if (sid && !sessionIds[SUPPORT.id]) {
      setSessionIds((s) => ({ ...s, [SUPPORT.id]: sid }));
    }
  }, [messages, sessionIds]);

  // auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const active = CONTACTS.find((c) => c.id === activeId) ?? SUPPORT;
  const isLive = active.id === SUPPORT.id;
  const fakeHistory: FakeMessage[] = FAKE_HISTORIES[active.id] ?? [];
  const busy = status === "submitted" || status === "streaming";

  const send = async () => {
    const text = input.trim();
    if ((!text && pickedFiles.length === 0) || busy) return;
    if (isLive) {
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
      setInput("");
      setPickedFiles([]);
      await sendMessage({ text: text || (parts.length ? "See attachment" : ""), files: parts });
    } else {
      // fake contacts just echo locally for the demo feel
      setInput("");
    }
  };

  const pickFiles = (files: FileList | null) => {
    if (files) setPickedFiles((p) => [...p, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex h-dvh bg-[#dadbd3] dark:bg-[#0b141a]">
      {/* left: contacts sidebar */}
      <aside className="flex w-full max-w-[420px] flex-col border-r md:w-[30%]">
        <header className="flex items-center justify-between bg-[#00a884] px-4 py-3 text-white dark:bg-[#202c33]">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">H</span>
            Helix Support
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white">
            demo
          </Badge>
        </header>
        <div className="bg-[#f6f6f6] p-2 dark:bg-[#111b21]">
          <Input placeholder="Search or start a new chat" className="rounded-lg" />
        </div>
        <ScrollArea className="flex-1 bg-white dark:bg-[#111b21]">
          {CONTACTS.map((c) => {
            const preview = c.live
              ? (messages[messages.length - 1]?.parts.find((p) => p.type === "text") as { text?: string })?.text ?? "Describe your issue or attach a file…"
              : (FAKE_HISTORIES[c.id]?.slice(-1)[0]?.text ?? "");
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted ${activeId === c.id ? "bg-muted" : ""}`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback style={{ background: c.color }}>{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.lastSeen}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm text-muted-foreground">{preview}</span>
                    {c.unread && <Badge className="h-5 rounded-full bg-[#00a884] px-2 text-white">{c.unread}</Badge>}
                    {c.live && <Badge variant="outline" className="h-5 border-[#00a884] px-2 text-[10px] text-[#00a884]">live</Badge>}
                  </div>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </aside>

      {/* right: chat pane */}
      <main className="relative hidden flex-1 flex-col md:flex">
        <header className="z-10 flex items-center justify-between border-b bg-[#f0f2f5] px-4 py-2 dark:bg-[#202c33]">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback style={{ background: active.color }}>{initials(active.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{active.name}</div>
              <div className="text-xs text-muted-foreground">
                {busy && isLive ? "typing…" : isLive ? "online" : "last seen recently"}
              </div>
            </div>
          </div>
          {isLive && (
            <Button variant="ghost" size="sm" onClick={() => setShowActivity(true)}>
              ⚡ Activity
            </Button>
          )}
        </header>

        <div className="chat-bg flex-1 overflow-y-auto py-4">
          <div className="mx-auto mb-3 w-fit rounded-md bg-[#ffeecd] px-3 py-2 text-center text-xs text-[#54656f] shadow-sm dark:bg-[#182229]">
            🔒 This demo streams one Helix bot session per conversation through your backend.
          </div>
          {isLive ? (
            <>
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-sm rounded-lg bg-white/90 p-6 text-center shadow dark:bg-[#202c33]">
                    <div className="mb-2 text-3xl">👋</div>
                    <div className="font-medium">Hi! I&apos;m your Helix support agent.</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ask a question or attach a file (PDF, image, spreadsheet) — everything you send lands in
                      the bot&apos;s workspace and I read it from there.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <Bubble key={m.id} message={m} contactName={SUPPORT.name} />
              ))}
              {busy && (
                <div className="flex justify-start px-6">
                  <div className="rounded-lg rounded-tl-none bg-white px-4 py-3 shadow-sm dark:bg-[#202c33]">
                    <span className="dot-1 inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                    <span className="dot-2 mx-1 inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                    <span className="dot-3 inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  </div>
                </div>
              )}
            </>
          ) : (
            fakeHistory.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"} px-6`}>
                <div
                  className={`my-1 max-w-[65%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    m.from === "me"
                      ? "rounded-tr-none bg-[#d9fdd3] dark:bg-[#005c4b]"
                      : "rounded-tl-none bg-white dark:bg-[#202c33]"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className="mt-0.5 text-right text-[10px] text-gray-500">{m.time}</div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* input bar */}
        <footer className="flex items-center gap-2 border-t bg-[#f0f2f5] px-4 py-2 dark:bg-[#202c33]">
          {pickedFiles.length > 0 && (
            <div className="absolute -top-14 left-4 right-4 flex gap-2 overflow-x-auto rounded-lg bg-background p-2 shadow-md">
              {pickedFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  📎 {f.name.length > 24 ? `${f.name.slice(0, 24)}…` : f.name}
                  <button
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setPickedFiles((p) => p.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,application/pdf,.txt,.csv,.xlsx,.docx"
            onChange={(e) => pickFiles(e.target.files)}
          />
          <Button variant="ghost" size="icon" disabled={!isLive} onClick={() => fileInputRef.current?.click()}>
            <span className="text-xl">📎</span>
          </Button>
          <Input
            className="rounded-full"
            placeholder={isLive ? "Type a message" : "Demo contacts are read-only"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={!isLive}
          />
          <Button size="icon" className="rounded-full" onClick={send} disabled={busy || !isLive}>
            {busy ? "…" : "➤"}
          </Button>
        </footer>

        <ActivitySheet open={showActivity} onOpenChange={setShowActivity} sessionId={sessionId} />
      </main>
    </div>
  );
}
