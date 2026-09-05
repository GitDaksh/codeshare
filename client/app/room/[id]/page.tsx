"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { getUserColor } from "@/lib/colors";
import { CodeEditor } from "@/components/CodeEditor";
import { LANGUAGES } from "@/lib/languages";
import type { Room } from "@/types/room";
import type { ChatMessage } from "@/types/chat";

const mockMessages: ChatMessage[] = [
  { id: "m1", sender: "Priya", text: "started on the sort function", timestamp: "10:02 AM" },
  { id: "m2", sender: "Arjun", text: "looks good, check line 14", timestamp: "10:04 AM" },
];

const starterCode = `function twoSum(nums, target) {
  const seen = new Map();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }

  return [];
}`;

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId: currentUserId } = useAuth();
  const api = useApi();
  const { status, onlineUsers } = useSocket(id);

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");

  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api
      .get<Room>(`/api/rooms/${id}`)
      .then((res) => setRoom(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [api, id]);

  useEffect(() => {
    if (room) {
      setCode(room.code || starterCode);
      setLanguage(room.language);
    }
  }, [room]);

  function handleSend() {
    if (!draft.trim()) return;
    setMessages([
      ...messages,
      {
        id: Math.random().toString(16).slice(2, 8),
        sender: "You",
        text: draft,
        timestamp: "just now",
      },
    ]);
    setDraft("");
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center">
        <p className="text-sm text-neutral-500">Loading room…</p>
      </main>
    );
  }

  if (notFound || !room) {
    return (
      <main className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-2">
        <p className="text-sm text-neutral-300">This room doesn't exist.</p>
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 underline transition-colors hover:text-neutral-300"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  const statusColor =
    status === "connected"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <main className="flex flex-col md:h-[calc(100vh-56px)]">
      {/* Room header */}
      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{room.name}</span>
          <span className="shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-neutral-500">
            {room._id}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs transition-colors hover:border-neutral-500"
          >
            Copy link
          </button>
        </div>
      </div>

      {/* Body: editor + sidebar */}
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        {/* Real Monaco editor */}
        <div className="min-h-[400px] min-w-0 flex-1 md:h-full md:min-h-0">
          <CodeEditor language={language} value={code} onChange={setCode} />
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col border-t border-neutral-800 md:h-full md:w-72 md:shrink-0 md:border-l md:border-t-0">
          <div className="border-b border-neutral-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Online — {onlineUsers.length}
              </h2>
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                {status}
              </span>
            </div>
            <ul className="space-y-1.5">
              {onlineUsers.map((u) => (
                <li key={u.socketId} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${getUserColor(u.userId)}`} />
                  {u.userId === currentUserId ? "You" : u.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat — still mock, real chat comes with backend work */}
          <div className="flex flex-col md:min-h-0 md:flex-1">
            <div className="max-h-64 space-y-3 overflow-y-auto p-3 md:max-h-none md:flex-1">
              {messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{msg.sender}</span>
                    <span className="text-xs text-neutral-500">{msg.timestamp}</span>
                  </div>
                  <p className="text-neutral-300">{msg.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-neutral-800 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Message the room…"
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              />
              <button
                onClick={handleSend}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}