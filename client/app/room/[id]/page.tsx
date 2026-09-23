"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Link as LinkIcon,
  Play,
  AlignLeft,
  Settings,
  Command as CommandIcon,
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  LayoutDashboard,
  Terminal,
  Loader2,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { useSocket, type ReactionUpdate } from "@/lib/socket";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Skeleton } from "@/components/Skeleton";
import { CodeEditor, type RemoteCursor, type RemoteCodeUpdate, type CodeEditorHandle } from "@/components/CodeEditor";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import { RunPanel } from "@/components/RunPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import { PresenceStack } from "@/components/PresenceStack";
import { RoomSettingsModal } from "@/components/RoomSettingsModal";
import { getStarterCode, LANGUAGES } from "@/lib/languages";
import { formatCode, isFormattable } from "@/lib/format";
import { executeCode, isRunnable, IDLE_RUN_STATE, type RunState } from "@/lib/execution";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Room } from "@/types/room";
import type { ChatMessage } from "@/types/chat";
import type { RemoteCursorEvent, TypingEvent } from "@/types/presence";
import type { LanguageUpdateEvent, RunResultEvent, RunStartEvent } from "@/types/roomEvents";

const SAVE_INDICATOR_DELAY_MS = 1800;
const TYPING_EXPIRY_MS = 4000;
const REMOTE_RUN_TIMEOUT_MS = 30000;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

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
  const router = useRouter();
  const { toast } = useToast();
  const { checking } = useOnboardingGate();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<RemoteCodeUpdate | null>(null);
  const [language, setLanguage] = useState("javascript");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeEditorRef = useRef<CodeEditorHandle | null>(null);

  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [runState, setRunState] = useState<RunState>(IDLE_RUN_STATE);
  const isSelfRunningRef = useRef(false);
  const remoteRunTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "online">("chat");
  const activeTabRef = useRef(activeTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [remoteCursors, setRemoteCursors] = useState<RemoteCursorEvent[]>([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    if (activeTabRef.current !== "chat") {
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const handleReactionUpdate = useCallback((update: ReactionUpdate) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === update.messageId ? { ...m, reactions: update.reactions } : m))
    );
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

  const handleLanguageUpdate = useCallback(
    (event: LanguageUpdateEvent) => {
      setLanguage(event.language);
      setRoom((prev) => (prev ? { ...prev, language: event.language } : prev));
      toast(`${event.name} switched the room to ${languageLabel(event.language)}`, "info");
    },
    [toast]
  );

  const handleRemoteRunStart = useCallback((event: RunStartEvent) => {
    if (remoteRunTimeoutRef.current) clearTimeout(remoteRunTimeoutRef.current);

    const runner = { name: event.name, avatarId: event.avatarId, isSelf: false };
    setRunState({ status: "running", result: null, runner, language: event.language });
    setRunPanelOpen(true);

    // If the runner disconnects mid-run, their result never arrives.
    // Don't leave everyone else staring at "running" forever.
    remoteRunTimeoutRef.current = setTimeout(() => {
      remoteRunTimeoutRef.current = null;
      setRunState((prev) =>
        prev.status === "running" && prev.runner && !prev.runner.isSelf && prev.runner.name === event.name
          ? {
              ...prev,
              status: "done",
              result: {
                output: "",
                error: `${event.name}'s run didn't finish. They may have disconnected.`,
                durationMs: 0,
              },
            }
          : prev
      );
    }, REMOTE_RUN_TIMEOUT_MS);
  }, []);

  const handleRemoteRunResult = useCallback((event: RunResultEvent) => {
    if (remoteRunTimeoutRef.current) {
      clearTimeout(remoteRunTimeoutRef.current);
      remoteRunTimeoutRef.current = null;
    }

    setRunState({
      status: "done",
      result: { output: event.output, error: event.error, durationMs: event.durationMs },
      runner: { name: event.name, avatarId: event.avatarId, isSelf: false },
      language: event.language,
    });
    setRunPanelOpen(true);
  }, []);

  const {
    status,
    onlineUsers,
    sendMessage,
    sendReaction,
    sendCodeChange,
    sendCursorMove,
    sendTyping,
    sendLanguageChange,
    sendRunStart,
    sendRunResult,
  } = useSocket(id, {
    onChatMessage: handleIncomingMessage,
    onCodeChange: handleIncomingCodeChange,
    onCursorMove: handleCursorMove,
    onTyping: handleTyping,
    onReactionUpdate: handleReactionUpdate,
    onLanguageUpdate: handleLanguageUpdate,
    onRunStart: handleRemoteRunStart,
    onRunResult: handleRemoteRunResult,
  });

  // Remote cursors enriched with each person's real avatar from presence.
  const editorCursors = useMemo<RemoteCursor[]>(
    () =>
      remoteCursors
        .filter((c) => c.userId !== currentUserId)
        .map((c) => ({
          ...c,
          avatarId: onlineUsers.find((u) => u.userId === c.userId)?.avatarId ?? c.userId,
        })),
    [remoteCursors, onlineUsers, currentUserId]
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
      if (remoteRunTimeoutRef.current) clearTimeout(remoteRunTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  function handleTabClick(tab: "chat" | "online") {
    setActiveTab(tab);
    if (tab === "chat") setUnreadCount(0);
  }

  async function handleFormat() {
    const code = codeEditorRef.current?.getValue() ?? "";
    const result = await formatCode(code, language);

    if (result.error) {
      toast(result.error, "error");
      return;
    }
    if (result.formatted && result.formatted !== code) {
      // setValue triggers the editor's normal onChange, which syncs and saves.
      codeEditorRef.current?.setValue(result.formatted);
      toast("Code formatted");
    }
  }

  async function handleRenameRoom(newName: string) {
    try {
      const res = await api.patch<Room>(`/api/rooms/${id}`, { name: newName });
      setRoom(res.data);
      document.title = `${res.data.name} — CodeShare`;
      toast("Room renamed");
    } catch {
      toast("Could not rename the room.", "error");
      throw new Error("rename failed");
    }
  }

  function handleLanguageChange(next: string) {
    if (next === language) return;
    const previous = language;

    setLanguage(next);
    setRoom((prev) => (prev ? { ...prev, language: next } : prev));
    sendLanguageChange(next);

    // If the editor still holds only the untouched starter comment, swap it
    // for the new language's comment style (e.g. // -> #).
    const current = codeEditorRef.current?.getValue() ?? "";
    const nextStarter = getStarterCode(next);
    if (current === getStarterCode(previous) && current !== nextStarter) {
      codeEditorRef.current?.setValue(nextStarter);
    }
  }

  async function handleRun() {
    setRunPanelOpen(true);
    if (!isRunnable(language) || isSelfRunningRef.current) return;

    isSelfRunningRef.current = true;
    if (remoteRunTimeoutRef.current) {
      clearTimeout(remoteRunTimeoutRef.current);
      remoteRunTimeoutRef.current = null;
    }

    const me = onlineUsers.find((u) => u.userId === currentUserId);
    const runner = { name: "You", avatarId: me?.avatarId ?? DEFAULT_AVATAR_ID, isSelf: true };
    const runLanguage = language;

    setRunState({ status: "running", result: null, runner, language: runLanguage });
    sendRunStart(runLanguage);

    try {
      const code = codeEditorRef.current?.getValue() ?? "";
      const result = await executeCode(code, runLanguage);
      setRunState({ status: "done", result, runner, language: runLanguage });
      sendRunResult(runLanguage, result);
    } finally {
      isSelfRunningRef.current = false;
    }
  }

  const isOwner = room?.ownerId === currentUserId;
  const isSelfRunning = runState.status === "running" && !!runState.runner?.isSelf;

  const commands: Command[] = [
    {
      id: "run",
      label: "Run code",
      icon: Play,
      action: handleRun,
    },
    {
      id: "output",
      label: runPanelOpen ? "Hide output panel" : "Show output panel",
      icon: Terminal,
      action: () => setRunPanelOpen((o) => !o),
    },
    {
      id: "format",
      label: "Format code",
      icon: AlignLeft,
      action: handleFormat,
      disabled: !isFormattable(language),
    },
    {
      id: "copy-link",
      label: "Copy room link",
      icon: LinkIcon,
      action: handleCopyLink,
    },
    {
      id: "zen",
      label: zenMode ? "Show sidebar" : "Enter focus mode",
      icon: zenMode ? Minimize2 : Maximize2,
      action: () => setZenMode((z) => !z),
    },
    {
      id: "minimap",
      label: minimapEnabled ? "Hide minimap" : "Show minimap",
      icon: MapIcon,
      action: () => setMinimapEnabled((m) => !m),
    },
    {
      id: "font-increase",
      label: "Increase font size",
      icon: ZoomIn,
      action: () => setFontSize((f) => Math.min(MAX_FONT_SIZE, f + 2)),
    },
    {
      id: "font-decrease",
      label: "Decrease font size",
      icon: ZoomOut,
      action: () => setFontSize((f) => Math.max(MIN_FONT_SIZE, f - 2)),
    },
    {
      id: "settings",
      label: "Rename room",
      icon: Settings,
      action: () => setSettingsOpen(true),
      disabled: !isOwner,
    },
    {
      id: "dashboard",
      label: "Go to dashboard",
      icon: LayoutDashboard,
      action: () => router.push("/dashboard"),
    },
  ];

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
          {isOwner && (
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Room settings"
              title="Room settings"
              className="shrink-0 text-ink-600 transition-colors hover:text-ink-100"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden shrink-0 rounded bg-ink-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-ink-500 lg:inline">
            {room._id}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-ink-500 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            {status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:block">
            <PresenceStack users={onlineUsers} currentUserId={currentUserId ?? null} />
          </div>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            title="Command palette (⌘K)"
            className="hidden items-center gap-1 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-500 transition-colors hover:border-ink-500 hover:text-ink-100 sm:flex"
          >
            <CommandIcon className="h-3 w-3" />K
          </button>
          <LanguageDropdown value={language} onChange={handleLanguageChange} />
          <button
            onClick={handleRun}
            disabled={isSelfRunning}
            title={isRunnable(language) ? "Run (⌘↵)" : `Running ${languageLabel(language)} isn't supported yet`}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
              isRunnable(language)
                ? "bg-ink-100 text-ink-950 hover:bg-white"
                : "border border-ink-700 text-ink-500 hover:border-ink-500"
            }`}
          >
            {isSelfRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </button>
          <div className="flex items-center gap-0.5 rounded-lg bg-ink-900/60 p-1">
            <button
              onClick={() => setRunPanelOpen((o) => !o)}
              aria-label={runPanelOpen ? "Hide output panel" : "Show output panel"}
              title={runPanelOpen ? "Hide output" : "Show output"}
              className={`rounded-md p-1.5 transition-colors ${
                runPanelOpen ? "bg-ink-100 text-ink-950" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <Terminal className="h-4 w-4" />
            </button>
            <button
              onClick={handleFormat}
              disabled={!isFormattable(language)}
              aria-label="Format code"
              title={isFormattable(language) ? "Format code" : "Formatting not supported for this language"}
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <AlignLeft className="h-4 w-4" />
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
              handleRef={codeEditorRef}
              language={language}
              initialValue={initialCode}
              remoteUpdate={remoteUpdate}
              onChange={handleCodeChange}
              onCursorMove={sendCursorMove}
              onRunShortcut={handleRun}
              remoteCursors={editorCursors}
              saveStatus={saveStatus}
              minimapEnabled={minimapEnabled}
              fontSize={fontSize}
            />
          </div>
          <RunPanel
            open={runPanelOpen}
            onClose={() => setRunPanelOpen(false)}
            onRun={handleRun}
            onClear={() => setRunState(IDLE_RUN_STATE)}
            runState={runState}
            language={language}
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
                    onClick={() => handleTabClick(tab)}
                    className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="sidebar-tab-pill"
                        className="absolute inset-0 rounded-md bg-ink-100"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                      />
                    )}
                    <span
                      className={`relative z-10 inline-flex items-center gap-1.5 ${
                        activeTab === tab ? "text-ink-950" : "text-ink-400"
                      }`}
                    >
                      {tab === "chat" ? "Chat" : `Online — ${onlineUsers.length}`}
                      {tab === "chat" && unreadCount > 0 && activeTab !== "chat" && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
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
                        {u.userId === room.ownerId && (
                          <span className="ml-auto text-[9px] uppercase tracking-wide text-ink-600">Owner</span>
                        )}
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
                  onReact={sendReaction}
                />
              )}
            </aside>
          </>
        )}
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} />
      <RoomSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentName={room.name}
        onSave={handleRenameRoom}
      />
    </main>
  );
}