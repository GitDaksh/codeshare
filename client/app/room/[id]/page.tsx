"use client";

import { use, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import type { OnlineUser } from "@/types/presence";

const mockUsers: OnlineUser[] = [
  { id: "u1", name: "You", color: "bg-emerald-500" },
  { id: "u2", name: "Priya", color: "bg-sky-500" },
  { id: "u3", name: "Arjun", color: "bg-amber-500" },
];

const mockMessages: ChatMessage[] = [
  { id: "m1", sender: "Priya", text: "started on the sort function", timestamp: "10:02 AM" },
  { id: "m2", sender: "Arjun", text: "looks good, check line 14", timestamp: "10:04 AM" },
];

const mockCode = `function twoSum(nums, target) {
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

const languages = ["JavaScript", "TypeScript", "Python", "C++", "Java"];

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [language, setLanguage] = useState(languages[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [draft, setDraft] = useState("");

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

  return (
    <main className="flex flex-col md:h-[calc(100vh-56px)]">
      {/* Room header */}
      <div className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Room</span>
          <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-neutral-500">
            {id}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
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
        {/* Editor placeholder */}
        <div className="min-h-[280px] min-w-0 flex-1 overflow-auto bg-neutral-900 p-4 md:h-full md:min-h-0">
          <pre className="font-[family-name:var(--font-mono)] text-sm leading-6 text-neutral-300">
            {mockCode.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="mr-4 w-6 shrink-0 select-none text-right text-neutral-600">
                  {i + 1}
                </span>
                <span>{line}</span>
              </div>
            ))}
          </pre>
        </div>

        {/* Sidebar */}
        <aside className="flex w-full flex-col border-t border-neutral-800 md:h-full md:w-72 md:shrink-0 md:border-l md:border-t-0">
          {/* Online users */}
          <div className="border-b border-neutral-800 p-3">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Online — {mockUsers.length}
            </h2>
            <ul className="space-y-1.5">
              {mockUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${user.color}`} />
                  {user.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat */}
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