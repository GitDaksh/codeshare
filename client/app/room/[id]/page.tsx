"use client";

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Maximize2, Minimize2, Link as LinkIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { useToast } from "@/components/ToastProvider";
import { getAvatarShade } from "@/lib/colors";
import { CodeEditor } from "@/components/CodeEditor";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import type { Room } from "@/types/room";
import type { ChatMessage } from "@/types/chat";

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

const SAVE_INDICATOR_DELAY_MS = 1800;

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId: currentUserId } = useAuth();
  const api = useApi();
  const { toast } = useToast();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "online">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const handleIncomingCodeChange = useCallback((incomingCode: string) => {
    setCode(incomingCode);
  }, []);

  const { status, onlineUsers, sendMessage, sendCodeChange } = useSocket(
    id,
    handleIncomingMessage,
    handleIncomingCodeChange
  );

  const [zenMode, setZenMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    api
      .get<Room>(`/api/rooms/${id}`)
      .then((res) => setRoom(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [api, id]);

  useEffect(() => {
    api
      .get<ChatMessage[]>(`/api/rooms/${id}/messages`)
      .then((res) => setMessages(res.data))
      .catch(() => toast("Could not load chat history.", "error"));
  }, [api, id]);

  useEffect(() => {
    if (room) {
      setCode(room.code || starterCode);
      setLanguage(room.language);
      document.title = `${room.name} — CodeShare`;
    }
  }, [room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(480, Math.max(220, newWidth)));
    }
    function handleMouseUp() {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  function handleDragStart(e: ReactMouseEvent) {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
  }

  function handleCodeChange(newCode: string) {
    setCode(newCode);
    sendCodeChange(newCode);

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), SAVE_INDICATOR_DELAY_MS);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied to clipboard");
  }

  function handleSend() {
    if (!draft.trim()) return;
    sendMessage(draft.trim());
    setDraft("");
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center">
        <p className="text-sm text-ink-500">Loading room…</p>
      </main>
    );
  }

  if (notFound || !room) {
    return (
      <main className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-2">
        <p className="text-sm text-ink-300">This room doesn't exist.</p>
        <Link
          href="/dashboard"
          className="text-sm text-ink-500 underline transition-colors hover:text-ink-300"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  const statusColor =
    status === "connected"
      ? "bg-ink-100 animate-pulse"
      : status === "connecting"
        ? "bg-ink-500"
        : "bg-red-500";

  return (
    <main className="flex flex-col md:h-[calc(100vh-56px)]">
      {/* Room header */}
      <div className="flex flex-col gap-2 border-b border-ink-800 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="shrink-0 text-ink-500 transition-colors hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate text-sm font-medium text-ink-100">{room.name}</span>
          <span className="shrink-0 rounded bg-ink-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-ink-500">
            {room._id}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-500 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            {status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageDropdown value={language} onChange={setLanguage} />
          <span className="hidden h-4 w-px bg-ink-800 sm:block" />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-1 text-xs text-ink-300 transition-colors hover:border-ink-500"
          >
            <LinkIcon className="h-3 w-3" />
            Copy link
          </button>
          <button
            onClick={() => setZenMode((z) => !z)}
            aria-label={zenMode ? "Show sidebar" : "Enter focus mode"}
            title={zenMode ? "Show sidebar" : "Focus mode"}
            className="hidden rounded-md border border-ink-700 p-1.5 text-ink-300 transition-colors hover:border-ink-500 md:block"
          >
            {zenMode ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Body: editor + sidebar */}
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="min-h-[400px] min-w-0 flex-1 md:h-full md:min-h-0">
          <CodeEditor
            language={language}
            value={code}
            onChange={handleCodeChange}
            saveStatus={saveStatus}
          />
        </div>

        {!zenMode && (
          <>
            <div
              onMouseDown={handleDragStart}
              className="hidden w-1 shrink-0 cursor-col-resize bg-ink-800 transition-colors hover:bg-ink-600 md:block"
            />
            <aside
              style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
              className="flex w-full flex-col border-t border-ink-800 md:h-full md:w-[var(--sidebar-width)] md:shrink-0 md:border-l md:border-t-0"
            >
              <div className="flex border-b border-ink-800">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === "chat"
                      ? "border-b-2 border-ink-100 text-ink-100"
                      : "text-ink-500 hover:text-ink-300"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("online")}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === "online"
                      ? "border-b-2 border-ink-100 text-ink-100"
                      : "text-ink-500 hover:text-ink-300"
                  }`}
                >
                  Online — {onlineUsers.length}
                </button>
              </div>

              {activeTab === "online" ? (
                <ul className="max-h-96 flex-1 space-y-2 overflow-y-auto p-3 md:max-h-none">
                  {onlineUsers.map((u) => {
                    const label = u.userId === currentUserId ? "You" : u.name;
                    return (
                      <li
                        key={u.socketId}
                        className="flex items-center gap-2 text-sm text-ink-100"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${getAvatarShade(u.userId)}`}
                        >
                          {label.charAt(0).toUpperCase()}
                        </span>
                        {label}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="max-h-96 flex-1 space-y-1 overflow-y-auto p-3 md:max-h-none">
                    {messages.length === 0 ? (
                      <p className="text-xs text-ink-600">No messages yet — say hi.</p>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg._id}
                          className="-mx-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-ink-900/60"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-ink-100">
                              {msg.senderId === currentUserId ? "You" : msg.senderName}
                            </span>
                            <span className="text-xs text-ink-500">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-ink-300">{msg.text}</p>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="flex gap-2 border-t border-ink-800 p-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Message the room…"
                      className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSend}
                      className="rounded-md bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </main>
  );
}