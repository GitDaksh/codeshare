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
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  LayoutDashboard,
  Terminal,
  Loader2,
  Code2,
  MessageSquare,
  Users,
  Ellipsis,
  WrapText,
  Copy,
  ClipboardCopy,
  Download,
  Keyboard,
  Search,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { useSocket, type ReactionUpdate } from "@/lib/socket";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useEditorTheme } from "@/lib/useEditorTheme";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { RoomSkeleton } from "@/components/RoomSkeleton";
import { CodeEditor, type RemoteCursor, type RemoteCodeUpdate, type CodeEditorHandle } from "@/components/CodeEditor";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import { RunPanel } from "@/components/RunPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import { PresenceStack } from "@/components/PresenceStack";
import { RoomSettingsModal } from "@/components/RoomSettingsModal";
import { openShortcutsDialog } from "@/components/ShortcutsDialog";
import { getStarterCode, LANGUAGES } from "@/lib/languages";
import { formatCode, isFormattable } from "@/lib/format";
import { executeCode, isRunnable, IDLE_RUN_STATE, type RunState } from "@/lib/execution";
import { EDITOR_THEMES } from "@/lib/editorTheme";
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
// Matches the server's chat message limit (the Message model's maxlength).
const CHAT_MESSAGE_LIMIT = 2000;

const FILE_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  cpp: "cpp",
  java: "java",
};

const FENCE_LANGUAGES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "python",
  cpp: "cpp",
  java: "java",
};

type MobilePanel = "code" | "chat" | "online";

const MOBILE_TABS: { id: MobilePanel; label: string; icon: LucideIcon }[] = [
  { id: "code", label: "Code", icon: Code2 },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "online", label: "People", icon: Users },
];

const STATUS_META: Record<string, { label: string; dot: string; live: boolean }> = {
  connected: { label: "Live", dot: "bg-ink-100", live: true },
  connecting: { label: "Connecting", dot: "bg-ink-500", live: false },
  disconnected: { label: "Offline", dot: "bg-red-500", live: false },
};

// Standalone icon buttons in the header (back, more).
const ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100";

// Buttons inside the grouped header toolbar.
const TOOL_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100";

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [editorTheme, setEditorTheme] = useEditorTheme();

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
  const [wordWrap, setWordWrap] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("code");
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isDraggingRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "online">("chat");
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [remoteCursors, setRemoteCursors] = useState<RemoteCursorEvent[]>([]);

  // Who was in the room at the last presence update (userId → name).
  // Starts empty and is set once we first appear in the list ourselves, so
  // people already here when we arrive aren't announced as "joined".
  const presenceBaselineRef = useRef<Map<string, string> | null>(null);

  const chatVisible = activeTab === "chat" && (isDesktop ? !zenMode : mobilePanel === "chat");
  const chatVisibleRef = useRef(chatVisible);

  useEffect(() => {
    chatVisibleRef.current = chatVisible;
  }, [chatVisible]);

  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    if (!chatVisibleRef.current) {
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

  // "Sam joined / left the room" notices. Compared by user (not by tab), so
  // someone with the room open in two tabs only ever counts once.
  useEffect(() => {
    if (!currentUserId) return;
    const current = new Map(onlineUsers.map((u) => [u.userId, u.name] as const));
    if (!current.has(currentUserId)) return;

    const previous = presenceBaselineRef.current;
    presenceBaselineRef.current = current;
    if (!previous) return;

    for (const [userId, name] of current) {
      if (userId !== currentUserId && !previous.has(userId)) toast(`${name} joined the room`, "info");
    }
    for (const [userId, name] of previous) {
      if (userId !== currentUserId && !current.has(userId)) toast(`${name} left the room`, "info");
    }
  }, [onlineUsers, currentUserId, toast]);

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

  function handleCopyRoomId() {
    if (!room) return;
    navigator.clipboard.writeText(room._id);
    toast("Room ID copied");
  }

  function handleCopyCode() {
    const code = codeEditorRef.current?.getValue() ?? "";
    navigator.clipboard.writeText(code);
    toast("Code copied to clipboard");
  }

  function handleDownloadCode() {
    if (!room) return;
    const code = codeEditorRef.current?.getValue() ?? "";
    const extension = FILE_EXTENSIONS[language] ?? "txt";
    // Java requires the file name to match the public class name.
    const baseName =
      language === "java" && /public\s+class\s+Main\b/.test(code) ? "Main" : slugify(room.name) || "code";
    const fileName = `${baseName}.${extension}`;

    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast(`Downloaded ${fileName}`);
  }

  function handleSendSelectionToChat() {
    const selection = codeEditorRef.current?.getSelection();
    if (!selection || !selection.text.trim()) {
      toast("Select some code first, then send it to chat.", "info");
      return;
    }

    const code = selection.text.replace(/\s+$/, "");
    const range =
      selection.startLine === selection.endLine
        ? `Line ${selection.startLine}`
        : `Lines ${selection.startLine}–${selection.endLine}`;
    const message = `${range}\n\`\`\`${FENCE_LANGUAGES[language] ?? ""}\n${code}\n\`\`\``;

    if (message.length > CHAT_MESSAGE_LIMIT) {
      toast("That selection is too long for chat. Try a smaller piece (about 2,000 characters max).", "error");
      return;
    }

    sendMessage(message);
    if (isDesktop && !zenMode) {
      setActiveTab("chat");
      setUnreadCount(0);
    }
    toast("Code sent to chat");
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

  function handleMobilePanel(panel: MobilePanel) {
    setMobilePanel(panel);
    if (panel !== "code") setActiveTab(panel);
    if (panel === "chat") setUnreadCount(0);
  }

  function handleToggleZen() {
    const next = !zenMode;
    setZenMode(next);
    if (!next && activeTab === "chat") setUnreadCount(0);
  }

  function handleToggleWordWrap() {
    setWordWrap((w) => !w);
  }

  async function handleFormat() {
    const code = codeEditorRef.current?.getValue() ?? "";
    const result = await formatCode(code, language);

    if (result.error) {
      toast(result.error, "error");
      return;
    }
    if (result.formatted && result.formatted !== code) {
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

    const current = codeEditorRef.current?.getValue() ?? "";
    const nextStarter = getStarterCode(next);
    if (current === getStarterCode(previous) && current !== nextStarter) {
      codeEditorRef.current?.setValue(nextStarter);
    }
  }

  async function handleRun() {
    setMobilePanel("code");
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
  const showSidebar = !zenMode || !isDesktop;
  const runnable = isRunnable(language);
  const statusMeta = STATUS_META[status] ?? STATUS_META.connecting;

  const desktopOnlyCommands: Command[] = isDesktop
    ? [
        {
          id: "zen",
          label: zenMode ? "Show sidebar" : "Enter focus mode",
          icon: zenMode ? Minimize2 : Maximize2,
          action: handleToggleZen,
        },
        {
          id: "minimap",
          label: minimapEnabled ? "Hide minimap" : "Show minimap",
          icon: MapIcon,
          action: () => setMinimapEnabled((m) => !m),
        },
      ]
    : [];

  const themeCommands: Command[] = EDITOR_THEMES.map((theme) => ({
    id: `theme-${theme.id}`,
    label: `Editor theme: ${theme.label}${theme.id === editorTheme ? " (current)" : ""}`,
    icon: Palette,
    action: () => setEditorTheme(theme.id),
  }));

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
      action: () => {
        setMobilePanel("code");
        setRunPanelOpen((o) => !o);
      },
    },
    {
      id: "send-to-chat",
      label: "Send selection to chat",
      icon: MessageSquare,
      action: handleSendSelectionToChat,
    },
    {
      id: "format",
      label: "Format code",
      icon: AlignLeft,
      action: handleFormat,
      disabled: !isFormattable(language),
    },
    {
      id: "copy-code",
      label: "Copy all code",
      icon: ClipboardCopy,
      action: handleCopyCode,
    },
    {
      id: "download",
      label: "Download code",
      icon: Download,
      action: handleDownloadCode,
    },
    {
      id: "word-wrap",
      label: wordWrap ? "Disable word wrap" : "Enable word wrap",
      icon: WrapText,
      action: handleToggleWordWrap,
    },
    ...themeCommands,
    {
      id: "copy-link",
      label: "Copy room link",
      icon: LinkIcon,
      action: handleCopyLink,
    },
    ...desktopOnlyCommands,
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
      id: "shortcuts",
      label: "Keyboard shortcuts",
      icon: Keyboard,
      action: openShortcutsDialog,
    },
    {
      id: "dashboard",
      label: "Go to dashboard",
      icon: LayoutDashboard,
      action: () => router.push("/dashboard"),
    },
  ];

  if (checking || loading || initialCode === null) {
    return <RoomSkeleton />;
  }

  if (notFound || !room) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center md:h-[calc(100dvh-56px)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
          <Code2 className="h-5 w-5 text-ink-300" />
        </div>
        <p className="font-semibold text-ink-100">This room doesn&apos;t exist</p>
        <p className="max-w-xs text-sm text-ink-400">It may have been deleted, or the link might be mistyped.</p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex h-9 items-center rounded-full border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  const shortRoomId = `${room._id.slice(0, 6)}…${room._id.slice(-4)}`;

  return (
    <main className="flex h-dvh flex-col bg-ink-950 md:h-[calc(100dvh-56px)]">
      {/* ---------- Header ---------- */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-950 px-2 sm:gap-3 sm:px-3 md:border-transparent">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard" className={ICON_BUTTON}>
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-ink-100">
              {room.name}
            </span>
            {isOwner && (
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Room settings"
                title="Room settings"
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 sm:flex"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span
            title={statusMeta.label}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] font-medium text-ink-300"
          >
            <span className="relative flex h-1.5 w-1.5">
              {statusMeta.live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-40" />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            </span>
            <span className="hidden sm:inline">{statusMeta.label}</span>
          </span>

          <button
            onClick={handleCopyRoomId}
            title="Copy room ID"
            className="hidden items-center gap-1.5 rounded-md px-1.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 lg:flex"
          >
            {shortRoomId}
            <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <PresenceStack users={onlineUsers} currentUserId={currentUserId ?? null} />
          </div>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            title="Command palette (⌘K)"
            className="hidden h-8 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100 md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Commands</span>
            <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-[10px] text-ink-400">
              ⌘K
            </kbd>
          </button>

          <LanguageDropdown value={language} onChange={handleLanguageChange} />

          <button
            onClick={handleRun}
            disabled={isSelfRunning}
            title={runnable ? "Run (⌘↵)" : `Running ${languageLabel(language)} isn't supported yet`}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${
              runnable
                ? "bg-ink-100 text-ink-950 shadow-[0_0_20px_-6px_rgba(255,255,255,0.5)] hover:bg-white"
                : "border border-ink-700 bg-ink-900 text-ink-400 hover:border-ink-500"
            }`}
          >
            {isSelfRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
            {runnable && (
              <kbd className="ml-0.5 hidden rounded bg-ink-950/10 px-1 font-[family-name:var(--font-mono)] text-[10px] text-ink-950/60 lg:inline">
                ⌘↵
              </kbd>
            )}
          </button>

          {/* Grouped toolbar */}
          <div className="hidden items-center gap-0.5 rounded-lg border border-ink-800 bg-ink-900 p-0.5 sm:flex">
            <button
              onClick={() => setRunPanelOpen((o) => !o)}
              aria-label={runPanelOpen ? "Hide output panel" : "Show output panel"}
              title={runPanelOpen ? "Hide output" : "Show output"}
              className={`${TOOL_BUTTON} ${runPanelOpen ? "bg-ink-800 text-ink-100" : ""}`}
            >
              <Terminal className="h-4 w-4" />
            </button>
            <button
              onClick={handleFormat}
              disabled={!isFormattable(language)}
              aria-label="Format code"
              title={isFormattable(language) ? "Format code" : "Formatting not supported for this language"}
              className={`${TOOL_BUTTON} disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button onClick={handleDownloadCode} aria-label="Download code" title="Download code" className={TOOL_BUTTON}>
              <Download className="h-4 w-4" />
            </button>
            <button onClick={handleCopyLink} aria-label="Copy room link" title="Copy room link" className={TOOL_BUTTON}>
              <LinkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleToggleZen}
              aria-label={zenMode ? "Show sidebar" : "Enter focus mode"}
              title={zenMode ? "Show sidebar" : "Focus mode"}
              className={`${TOOL_BUTTON} hidden md:flex ${zenMode ? "bg-ink-800 text-ink-100" : ""}`}
            >
              {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="More actions"
            className={`${ICON_BUTTON} sm:hidden`}
          >
            <Ellipsis className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ---------- Body: floating panels on desktop, full-bleed on phones ---------- */}
      <div className="flex min-h-0 flex-1 md:px-2 md:pb-2">
        <div
          className={`${mobilePanel === "code" ? "flex" : "hidden"} min-w-0 flex-1 flex-col bg-ink-900 md:flex md:overflow-hidden md:rounded-xl md:border md:border-ink-800`}
        >
          <div className="min-h-0 flex-1">
            <CodeEditor
              handleRef={codeEditorRef}
              language={language}
              initialValue={initialCode}
              remoteUpdate={remoteUpdate}
              onChange={handleCodeChange}
              onCursorMove={sendCursorMove}
              onRunShortcut={handleRun}
              onSendSelection={handleSendSelectionToChat}
              remoteCursors={editorCursors}
              saveStatus={saveStatus}
              minimapEnabled={minimapEnabled}
              fontSize={fontSize}
              wordWrap={wordWrap}
              onToggleWordWrap={handleToggleWordWrap}
              themeId={editorTheme}
              onThemeChange={setEditorTheme}
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

        {showSidebar && (
          <>
            {/* Resize gutter: an 8px gap with a grab handle that appears on hover */}
            <div
              onMouseDown={handleDragStart}
              className="group relative hidden w-2 shrink-0 cursor-col-resize md:block"
              title="Drag to resize"
            >
              <div className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-700 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            <aside
              style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
              className={`${mobilePanel === "code" ? "hidden" : "flex"} w-full min-w-0 flex-col bg-ink-900 md:flex md:w-[var(--sidebar-width)] md:shrink-0 md:overflow-hidden md:rounded-xl md:border md:border-ink-800`}
            >
              <div className="hidden p-2 md:block">
                <div className="relative flex rounded-lg border border-ink-800 bg-ink-950/60 p-1">
                  {(["chat", "online"] as const).map((tab) => {
                    const active = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => handleTabClick(tab)}
                        className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium"
                      >
                        {active && (
                          <motion.div
                            layoutId="sidebar-tab-pill"
                            className="absolute inset-0 rounded-md bg-ink-800 shadow-sm ring-1 ring-ink-700"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                          />
                        )}
                        <span
                          className={`relative z-10 inline-flex items-center justify-center gap-1.5 transition-colors ${
                            active ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
                          }`}
                        >
                          {tab === "chat" ? "Chat" : "People"}
                          {tab === "online" && (
                            <span className="rounded border border-ink-700 bg-ink-900 px-1 text-[10px] tabular-nums text-ink-300">
                              {onlineUsers.length}
                            </span>
                          )}
                          {tab === "chat" && unreadCount > 0 && !active && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === "online" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="px-4 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wider text-ink-400 md:pt-1">
                    In this room · {onlineUsers.length}
                  </p>
                  <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
                    {onlineUsers.map((u) => {
                      const isYou = u.userId === currentUserId;
                      return (
                        <li
                          key={u.socketId}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-800/60"
                        >
                          <span className="relative shrink-0">
                            <AvatarIcon avatarId={u.avatarId} className="h-8 w-8 rounded-full md:h-7 md:w-7" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-ink-100" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">
                            {isYou ? "You" : u.name}
                          </span>
                          {u.userId === room.ownerId && (
                            <span className="shrink-0 rounded border border-ink-700 bg-ink-800 px-1.5 py-px text-[10px] font-medium text-ink-300">
                              Owner
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {onlineUsers.length <= 1 && (
                    <div className="mx-2 mb-2 rounded-xl border border-dashed border-ink-700 bg-ink-950/50 p-4 text-center">
                      <p className="text-sm font-medium text-ink-100">You&apos;re the only one here</p>
                      <p className="mt-1 text-xs text-ink-400">Share the room link to code together.</p>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-100 px-3.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-white active:scale-[0.98]"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Copy invite link
                      </button>
                    </div>
                  )}
                </div>
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

      {/* ---------- Phones: bottom tab bar ---------- */}
      <nav className="flex shrink-0 gap-1 border-t border-ink-800 bg-ink-950 px-2 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 md:hidden">
        {MOBILE_TABS.map(({ id: tabId, label, icon: Icon }) => {
          const active = mobilePanel === tabId;
          return (
            <button
              key={tabId}
              onClick={() => handleMobilePanel(tabId)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium"
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-indicator"
                  className="absolute inset-0 rounded-xl border border-ink-700 bg-ink-800"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
              <span className="relative">
                <Icon className={`h-5 w-5 transition-colors ${active ? "text-ink-100" : "text-ink-400"}`} />
                {tabId === "chat" && unreadCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className={`relative transition-colors ${active ? "text-ink-100" : "text-ink-400"}`}>
                {tabId === "online" ? `${label} · ${onlineUsers.length}` : label}
              </span>
            </button>
          );
        })}
      </nav>

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