/**
 * Fake contacts for the WhatsApp-style sidebar. The first entry is special:
 * it is the live connection to the Helix customer-support bot. The rest have
 * static demo histories so the UI looks alive out of the box.
 */
export type Contact = {
  id: string;
  name: string;
  color: string;
  lastSeen: string;
  unread?: number;
  live?: boolean; // backed by a real Helix bot session
};

export type FakeMessage = {
  from: "them" | "me";
  text: string;
  time: string;
};

export const CONTACTS: Contact[] = [
  {
    id: "support",
    name: "Meydan Free Zone",
    color: "#00a884",
    lastSeen: "online",
    live: true,
  },
  { id: "c1", name: "Priya Sharma", color: "#7c5cff", lastSeen: "10:12" },
  { id: "c2", name: "Marcus Webb", color: "#f5a623", lastSeen: "Yesterday", unread: 2 },
  { id: "c3", name: "Aisha Khan", color: "#e5537d", lastSeen: "Yesterday" },
  { id: "c4", name: "Tom Ellis", color: "#35a3e8", lastSeen: "Mon" },
  { id: "c5", name: "Lena Fischer", color: "#8bc34a", lastSeen: "Mon" },
  { id: "c6", name: "Diego Ruiz", color: "#ff7043", lastSeen: "Sun" },
];

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const FAKE_HISTORIES: Record<string, FakeMessage[]> = {
  support: [],
  c1: [
    { from: "them", text: "Hey! Did you get a chance to look at the mockups?", time: "09:58" },
    { from: "me", text: "Yes — v3 is much better. Ship it 🚀", time: "10:02" },
    { from: "them", text: "Amazing. I'll send the invoice over later today.", time: "10:03" },
  ],
  c2: [
    { from: "them", text: "The delivery is stuck at customs 😩", time: "16:41" },
    { from: "them", text: "Any chance you can call the forwarder?", time: "16:42" },
    { from: "me", text: "On it — give me an hour.", time: "16:45" },
  ],
  c3: [
    { from: "me", text: "Lunch on Friday?", time: "12:20" },
    { from: "them", text: "Can't, travelling. Next week!", time: "13:01" },
  ],
  c4: [
    { from: "them", text: "Game tonight?", time: "18:30" },
    { from: "me", text: "Always.", time: "18:31" },
  ],
  c5: [
    { from: "them", text: "Danke für die Hilfe gestern!", time: "09:15" },
    { from: "me", text: "Anytime 🙂", time: "09:20" },
  ],
  c6: [
    { from: "them", text: "¿Listo para el lanzamiento?", time: "20:44" },
    { from: "me", text: "Ready when you are.", time: "20:50" },
  ],
};
