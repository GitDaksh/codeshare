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
import { motion } from "framer-motion";
import { ArrowLeft, Maximize2, Minimize2, Link as LinkIcon, Play } from "lucide-react";
import { useApi } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Skeleton } from "@/components/Skeleton";
import { CodeEditor, type RemoteCursor, type RemoteCodeUpdate, type CodeEditorHandle } from "@/components/CodeEditor";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import { RunPanel } from "@/components/RunPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { getStarterCode } from "@/lib/languages";
import type { Room } from "@/types/room";
import type { ChatMessage } from "@/types/chat";
import type { RemoteCursorEvent, TypingEvent } from "@/types/presence";

const SAVE_INDICATOR_DELAY_MS = 1800;
const TYPING_EXPIRY_MS = 4000;

function RoomLoadingSkeleton() {
  return (
    <main className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1">
        <Skeleton className="flex-1 rounded-none" />
        <div className="hidden w-72 shrink-0 border-l border-ink-800 bg-ink-900/40 p-3 md:block">
          <Skeleton className="mb-3 h-9 w-full rounded-lg" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId: currentUserId } = useAuth();
  const api = useApi();
  const { toast } = useToast();
  const { checking } = useOnboardingGate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteCodeUpdate | null>(null);
  const [language, setLanguage] = useState("javascript");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const [runPanelOpen, setRunPanelOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "online">("chat");
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const handleIncomingCodeChange = useCallback(
    (incomingCode: string, cursor: RemoteCursorEvent | null) => {
      setRemoteUpdate((prev) => ({ code: incomingCode, nonce: (prev?.nonce ?? 0) + 1 }));
      if (cursor) {
        setRemoteCursors((prev) => [...prev.filter((c) => c.userId !== cursor.userId), cursor]);
      }
    },
    []
  );

  const handleCursorMove = useCallback((cursor: RemoteCursorEvent) => {
    setRemoteCursors((prev) => [...prev.filter((c) => c.userId !== cursor.userId), cursor]);
  }, []);

  const handleTyping = useCallback((event: TypingEvent) => {
    const existing = typingTimeoutsRef.current.get(event.userId);
    if (existing) clearTimeout(existing);

    if (event.isTyping) {
      setTypingUsers((prev) => [...prev.filter((u) => u.userId !== event.userId), event]);
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== event.userId));
        typingTimeoutsRef.current.delete(event.userId);
      }, TYPING_EXPIRY_MS);
      typingTimeoutsRef.current.set(event.userId, timeout);
    } else {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== event.userId));
      typingTimeoutsRef.current.delete(event.userId);
    }
  }, []);

  const { status, onlineUsers, sendMessage, sendCodeChange, sendCursorMove, sendTyping } = useSocket(
    id,
    handleIncomingMessage,
    handleIncomingCodeChange,
    handleCursorMove,
    handleTyping
  );

  const [zenMode, setZenMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    api
      .get<Room>(`/api/rooms/${id}`)
      .then((res) => {
        setRoom(res.data);
        setLanguage(res.data.language);
        setInitialCode(res.data.code || getStarterCode(res.data.language));
        document.title = `${res.data.name} — CodeShare`;
      })
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
    const onlineIds = new Set(onlineUsers.map((u) => u.userId));
    setRemoteCursors((prev) => prev.filter((c) => onlineIds.has(c.userId)));
    setTypingUsers((prev) => prev.filter((u) => onlineIds.has(u.userId)));
  }, [onlineUsers]);

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

  function handleCodeChange(newCode: string, line: number, column: number) {
    sendCodeChange(newCode, line, column);

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

  if (checking || loading || initialCode === null) {
    return <RoomLoadingSkeleton />;
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
      <div className="flex flex-col gap-2 border-b border-ink-800 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="shrink-0 text-ink-500 transition-colors hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate font-[family-name:var(--font-display)] text-sm font-semibold text-ink-100">
            {room.name}
          </span>
          <span className="shrink-0 rounded bg-ink-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-ink-500">
            {room._id}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-500 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            {status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageDropdown value={language} onChange={setLanguage} />
          <div className="flex items-center gap-0.5 rounded-lg bg-ink-900/60 p-1">
            <button
              onClick={() => setRunPanelOpen((o) => !o)}
              aria-label={runPanelOpen ? "Hide output" : "Run code"}
              title={runPanelOpen ? "Hide output" : "Run code"}
              className={`rounded-md p-1.5 transition-colors ${
                runPanelOpen
                  ? "bg-ink-100 text-ink-950"
                  : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopyLink}
              aria-label="Copy room link"
              title="Copy room link"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZenMode((z) => !z)}
              aria-label={zenMode ? "Show sidebar" : "Enter focus mode"}
              title={zenMode ? "Show sidebar" : "Focus mode"}
              className="hidden rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 md:block"
            >
              {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <div className="flex min-h-[400px] min-w-0 flex-1 flex-col md:h-full md:min-h-0">
          <div className="min-h-0 flex-1">
            <CodeEditor
              ref={codeEditorRef}
              language={language}
              initialValue={initialCode}
              remoteUpdate={remoteUpdate}
              onChange={handleCodeChange}
              onCursorMove={sendCursorMove}
              remoteCursors={remoteCursors.filter((c) => c.userId !== currentUserId)}
              saveStatus={saveStatus}
            />
          </div>
          <RunPanel
            getCode={() => codeEditorRef.current?.getValue() ?? ""}
            language={language}
            open={runPanelOpen}
            onClose={() => setRunPanelOpen(false)}
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
              className="flex w-full flex-col border-t border-ink-800 bg-ink-900/40 md:h-full md:w-[var(--sidebar-width)] md:shrink-0 md:border-l md:border-t-0"
            >
              <div className="relative flex gap-1 p-2">
                {(["chat", "online"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="sidebar-tab-pill"
                        className="absolute inset-0 rounded-md bg-ink-100"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                      />
                    )}
                    <span className={`relative z-10 ${activeTab === tab ? "text-ink-950" : "text-ink-400"}`}>
                      {tab === "chat" ? "Chat" : `Online — ${onlineUsers.length}`}
                    </span>
                  </button>
                ))}
              </div>

              {activeTab === "online" ? (
                <ul className="max-h-96 flex-1 space-y-1 overflow-y-auto p-2 md:max-h-none">
                  {onlineUsers.map((u) => {
                    const label = u.userId === currentUserId ? "You" : u.name;
                    return (
                      <li
                        key={u.socketId}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-ink-100 transition-colors hover:bg-ink-900/60"
                      >
                        <AvatarIcon avatarId={u.avatarId} className="h-6 w-6 shrink-0 rounded-full" />
                        {label}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ChatPanel
                  messages={messages}
                  currentUserId={currentUserId ?? null}
                  typingUsers={typingUsers}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSend={handleSend}
                  onTypingChange={sendTyping}
                />
              )}
            </aside>
          </>
        )}
      </div>
    </main>
  );
}