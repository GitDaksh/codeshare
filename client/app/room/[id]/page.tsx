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
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Eye,
  Link as LinkIcon,
  UserPlus,
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
  ClipboardCopy,
  Download,
  Keyboard,
  Search,
  Palette,
  BookOpen,
  FlaskConical,
  ScanEye,
  ClipboardList,
  Timer,
  Sun,
  Moon,
  Flame,
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
import { CodeEditor, type CodeEditorHandle } from "@/components/CodeEditor";
import { LanguageDropdown } from "@/components/LanguageDropdown";
import { RunPanel } from "@/components/RunPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ComplexityMeter } from "@/components/ComplexityMeter";
import { CommandPalette, type Command } from "@/components/CommandPalette";
import { PresenceStack } from "@/components/PresenceStack";
import { RoomSettingsModal } from "@/components/RoomSettingsModal";
import { PeoplePanel } from "@/components/PeoplePanel";
import { ShareDialog } from "@/components/ShareDialog";
import { openShortcutsDialog } from "@/components/ShortcutsDialog";
import { ProblemPanel } from "@/components/ProblemPanel";
import { RoomLens } from "@/components/lens/RoomLens";
import { InterviewBar } from "@/components/interview/InterviewBar";
import { Menu, type MenuEntry } from "@/components/Menu";
import { useTheme } from "@/lib/theme";
import { useHotspots } from "@/lib/useHotspots";
import { HotspotsBar } from "@/components/hotspots/HotspotsBar";
import { HOTSPOTS_LANE_WIDTH, HotspotsLane } from "@/components/hotspots/HotspotsLane";
import { revealLine, useEditorHeat } from "@/components/hotspots/useEditorHeat";
import { InterviewOverlays } from "@/components/interview/InterviewOverlays";
import { InterviewLobby } from "@/components/interview/InterviewLobby";
import { InterviewSetup, type InterviewSetupChoice } from "@/components/interview/InterviewSetup";
import { InterviewerPanel } from "@/components/interview/InterviewerPanel";
import { GivenHints, QuestionPanel } from "@/components/interview/QuestionPanel";
import { Scorecard, type ScorecardChoice } from "@/components/interview/Scorecard";
import { getStarterCode, LANGUAGES } from "@/lib/languages";
import { formatCode, isFormattable } from "@/lib/format";
import {
  executeCode,
  isLensLanguage,
  isRunnable,
  runTests,
  IDLE_RUN_STATE,
  type RunState,
  type TestRunReport,
} from "@/lib/execution";
import {
  functionNameFor,
  getProblem,
  getProblemStarterCode,
  isTestableLanguage,
  type Problem,
} from "@/lib/problems";
import { EDITOR_THEMES } from "@/lib/editorTheme";
import { useCollab } from "@/lib/collab";
import { useComplexity } from "@/lib/useComplexity";
import { useRoomLens } from "@/lib/useRoomLens";
import { isCandidateIn, isInterviewerIn, useInterview, type InterviewState } from "@/lib/interview";
import { useInterviewMonitor } from "@/lib/useInterviewMonitor";
import { interviewKit } from "@/lib/interviewKits";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { AccessRequest, Room, RoomPerson, RoomRole } from "@/types/room";
import type { ChatMessage } from "@/types/chat";
import type { TypingEvent } from "@/types/presence";
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

type SidebarTab = "problem" | "chat" | "online" | "interview";
type MobilePanel = "code" | SidebarTab;

const SIDEBAR_TAB_LABELS: Record<SidebarTab, string> = {
  problem: "Problem",
  chat: "Chat",
  online: "People",
  interview: "Interview",
};

// The Problem tab only shows up in rooms started from a Practice problem.
const MOBILE_TABS: { id: MobilePanel; label: string; icon: LucideIcon }[] = [
  { id: "code", label: "Code", icon: Code2 },
  { id: "problem", label: "Problem", icon: BookOpen },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "online", label: "People", icon: Users },
  { id: "interview", label: "Interview", icon: ClipboardList },
];

const STATUS_META: Record<string, { label: string; dot: string; tone: string; live: boolean }> = {
  connected: { label: "Live", dot: "bg-success-strong", tone: "border-success-line bg-success-soft text-success", live: true },
  connecting: { label: "Connecting", dot: "bg-warning-strong", tone: "border-warning-line bg-warning-soft text-warning", live: false },
  disconnected: { label: "Offline", dot: "bg-danger-strong", tone: "border-danger-line bg-danger-soft text-danger", live: false },
};

// Standalone icon buttons in the header (back, more).
const ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100";

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

// Why a viewer's controls are greyed out.
const VIEW_ONLY = "View only. Ask the owner for edit access.";

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId: currentUserId } = useAuth();
  const api = useApi();
  const router = useRouter();
  // An invite link (/room/<id>?invite=<code>) lets someone new join the room.
  const invite = useSearchParams().get("invite");
  const inviteQuery = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  const { toast } = useToast();
  const { checking, profile } = useOnboardingGate();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [editorTheme, setEditorTheme, editorThemeAuto] = useEditorTheme();
  const appTheme = useTheme();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Everyone in the room, for the People tab (null until it loads).
  const [people, setPeople] = useState<RoomPerson[] | null>(null);
  // Set while you leave, so the "you were removed" notice that follows isn't shown.
  const leavingRef = useRef(false);
  // Your role here. Viewers can watch, follow and chat, but not change the code.
  const role: RoomRole = room?.role ?? (room && room.ownerId === currentUserId ? "owner" : "editor");
  const canEdit = role !== "viewer";
  // Interview rooms are joined with the interview's own links instead.
  const canInvite = !!room?.invites && !room?.interviewId;
  // Owner: viewers asking to edit. Viewer: whether you've just asked.
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const knownRequestsRef = useRef(new Set<string>());
  const [asked, setAsked] = useState(false);

  const [initialCode, setInitialCode] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Follow mode: the teammate whose cursor your editor keeps in view.
  const [following, setFollowing] = useState<string | null>(null);
  // Tells the Big-O meter the code changed (set once the meter exists).
  const meterChangedRef = useRef<() => void>(() => {});

  // Practice: test state (the problem itself is decided below, since an
  // interview can set it).
  const [testReport, setTestReport] = useState<TestRunReport | null>(null);
  const [testsRunning, setTestsRunning] = useState(false);
  const testsRunningRef = useRef(false);
  const [solvedSlugs, setSolvedSlugs] = useState<Set<string>>(() => new Set());

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
      setTestReport(null);
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
    socket,
    sendMessage,
    sendReaction,
    sendTyping,
    sendLanguageChange,
    sendRunStart,
    sendRunResult,
    sendLensStart,
    sendLensStep,
    sendLensDrive,
    sendLensStop,
    sendAccessRequest,
    sendAccessDismiss,
  } = useSocket(id, {
    onChatMessage: handleIncomingMessage,
    onTyping: handleTyping,
    onReactionUpdate: handleReactionUpdate,
    onLanguageUpdate: handleLanguageUpdate,
    onRunStart: handleRemoteRunStart,
    onRunResult: handleRemoteRunResult,
    onLensSession: (event) => void lens.receiveSession(event),
    onLensStep: (event) => lens.receiveStep(event),
    onLensDriver: (event) => lens.receiveDriver(event),
    onLensStop: (event) => lens.receiveStop(event),
    onRole: (next) => handleRoleChange(next),
    onRemoved: () => handleRemoved(),
    onPeople: () => {
      loadPeople();
      refreshAccess();
    },
    onAccessRequests: (requests) => handleAccessRequests(requests),
    onAccessRequested: (ownerHere) =>
      toast(
        ownerHere
          ? "Asked the owner for edit access."
          : "The owner isn't in the room right now. They'll see your request when they're back.",
        "info"
      ),
  }, invite);

  // Interviews: this room's interview, if it has one (lib/interview.ts).
  const [setupOpen, setSetupOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const iv = useInterview(socket, id, {
    // Interviewers land on their panel; the candidate on the question.
    onNew: (state) => {
      const staff = isInterviewerIn(state, currentUserId);
      setActiveTab(staff && state.mode === "live" ? "interview" : state.status === "scheduled" ? "chat" : "problem");
      setMobilePanel("code");
      setTestReport(null);
    },
    onStarted: (state) => {
      if (!isInterviewerIn(state, currentUserId) || state.mode === "solo") setActiveTab("problem");
    },
    onQuestion: (state) => {
      setTestReport(null);
      if (!isInterviewerIn(state, currentUserId) || state.mode === "solo") setActiveTab("problem");
    },
    onEnded: (state) => {
      if (isInterviewerIn(state, currentUserId)) setScorecardOpen(true);
    },
    onError: (message) => toast(message, "error"),
  });
  const interview = iv.interview;
  const interviewOpen = !!interview && interview.status !== "ended";
  const interviewLive = !!interview && (interview.status === "running" || interview.status === "paused");
  const isInterviewer = !!interview && isInterviewerIn(interview, currentUserId);
  const isInterviewCandidate = !!interview && isCandidateIn(interview, currentUserId);
  const showInterviewTab = isInterviewer && interview?.mode === "live";
  // What the interview lets the candidate use (interviewers always can).
  const lockedBy = (setting: "runTests" | "lens" | "meter") =>
    !!interview && interviewOpen && !isInterviewer && !interview.settings[setting];
  const testsLocked = lockedBy("runTests");
  const lensLocked = lockedBy("lens");
  const meterHidden = lockedBy("meter");
  // Until it starts, the candidate's editor is read-only.
  const lobbyLocked = !!interview && interview.status === "scheduled" && !isInterviewer;
  useInterviewMonitor(interview, currentUserId, iv.monitor);

  // The question: the interview's current one (once you may see it),
  // otherwise the room's own (in Practice rooms).
  const question =
    interview && !interview.questions[interview.current]?.hidden ? (interview.questions[interview.current] ?? null) : null;
  const problemSlug = interview ? (question?.problemSlug ?? null) : (room?.problemSlug ?? null);
  const customQuestion = question && !question.problemSlug ? question : null;
  const problem = useMemo(() => (problemSlug ? getProblem(problemSlug) : null), [problemSlug]);
  const hasInterview = !!interview;
  const kit = useMemo(() => (hasInterview && problem ? interviewKit(problem) : null), [hasInterview, problem]);
  // The current question's hints in order: the kit's ladder, or the interviewer's own.
  const interviewHints = question ? (question.problemSlug ? (kit?.hints ?? []) : (question.hints ?? [])) : [];

  // Shared editing: the room's document, kept in step over the socket (Yjs).
  const collab = useCollab(socket, id, () =>
    toast("That edit would make the code longer than 100,000 characters, so it wasn't saved.", "error")
  );

  // Follow mode ends by itself when that person leaves.
  const followed = following ? onlineUsers.find((u) => u.userId === following && u.userId !== currentUserId) : null;

  // Lens: shared step-by-step visualizations of the room's code.
  const lensMe = useMemo(() => {
    const me = onlineUsers.find((user) => user.userId === currentUserId);
    return me ? { userId: me.userId, name: me.name, avatarId: me.avatarId } : null;
  }, [onlineUsers, currentUserId]);
  const getLensCode = useCallback(() => codeEditorRef.current?.getValue() ?? "", []);
  const lens = useRoomLens({
    canDrive: canEdit,
    me: lensMe,
    send: { start: sendLensStart, step: sendLensStep, drive: sendLensDrive, stop: sendLensStop },
    notify: toast,
    // Practice rooms visualize a test (see useRoomLens).
    context: { language, getCode: getLensCode, problem, report: testReport },
  });

  // The Big-O meter: measures the room's code a moment after it stops
  // changing (by itself on desktop; with a tap on phones).
  const meter = useComplexity({ language, getCode: getLensCode, problem, auto: isDesktop });
  useEffect(() => {
    meterChangedRef.current = meter.notifyChange;
  });

  // Hotspots: how many times every line ran, painted into the editor (only
  // on your own screen, so viewers can use it too).
  const hotspots = useHotspots({ language, getCode: getLensCode, problem });
  const getMonaco = useCallback(() => codeEditorRef.current?.getEditor() ?? null, []);
  useEditorHeat(getMonaco, hotspots.open ? hotspots.result : null, hotspots.stale);

  // The candidate's Big-O readings go into the interview's record.
  const meterResult = meter.result;
  const meterStale = meter.stale;
  const reportComplexity = iv.reportComplexity;
  useEffect(() => {
    if (!interviewLive || !isInterviewCandidate || meterStale || meterResult?.status !== "ok") return;
    reportComplexity(meterResult.time.label, meterResult.space?.label ?? null);
  }, [interviewLive, isInterviewCandidate, meterStale, meterResult, reportComplexity]);

  // A room that's still empty (made before rooms started with starter code)
  // gets it once, from its owner's browser only, so it's never added twice.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!collab.synced || seededRef.current || !room || room.code || room.ownerId !== currentUserId) return;
    seededRef.current = true;
    const { doc, text } = collab.session;
    if (text.length > 0) return;
    const starter =
      (problem ? getProblemStarterCode(problem, room.language) : null) ?? getStarterCode(room.language);
    doc.transact(() => text.insert(0, starter), "starter");
  }, [collab.synced, collab.session, room, currentUserId, problem]);

  useEffect(() => {
    api
      .get<Room>(`/api/rooms/${id}${inviteQuery}`)
      .then((res) => {
        const loadedProblem = res.data.problemSlug ? getProblem(res.data.problemSlug) : null;
        setRoom(res.data);
        setLanguage(res.data.language);
        setInitialCode(
          res.data.code ||
            (loadedProblem ? getProblemStarterCode(loadedProblem, res.data.language) : null) ||
            getStarterCode(res.data.language)
        );
        // Practice rooms open on the Problem tab.
        if (loadedProblem) setActiveTab("problem");
        document.title = `${res.data.name} — CodeShare`;
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [api, id, inviteQuery]);

  useEffect(() => {
    api
      .get<ChatMessage[]>(`/api/rooms/${id}/messages${inviteQuery}`)
      .then((res) => setMessages(res.data))
      .catch((err) => {
        // A room you can't open shows its own message instead.
        if ((err as { response?: { status?: number } })?.response?.status === 404) return;
        toast("Could not load chat history.", "error");
      });
  }, [api, id, inviteQuery]);

  useEffect(() => {
    const solved = profile?.solvedProblems;
    if (!solved) return;
    setSolvedSlugs((prev) => {
      const next = new Set(prev);
      for (const entry of solved) next.add(entry.slug);
      return next;
    });
  }, [profile]);

  useEffect(() => {
    const onlineIds = new Set(onlineUsers.map((u) => u.userId));
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

  // Your own edits (they reach everyone through the shared document).
  function handleCodeChange() {
    meterChangedRef.current();
    hotspots.notifyChange();

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), SAVE_INDICATOR_DELAY_MS);
  }

  // Both re-reads below can overlap; only the newest answer counts, so a
  // slower, older one can't undo a change that arrived after it.
  const peopleReadRef = useRef(0);
  const accessReadRef = useRef(0);

  // Who's in the room, for the People tab.
  const loadPeople = useCallback(() => {
    const read = ++peopleReadRef.current;
    api
      .get<{ people: RoomPerson[] }>(`/api/rooms/${id}/people`)
      .then((res) => {
        if (read === peopleReadRef.current) setPeople(res.data.people);
      })
      .catch(() => {});
  }, [api, id]);

  // Your role and the invite links can change while you're here.
  const refreshAccess = useCallback(() => {
    const read = ++accessReadRef.current;
    api
      .get<Room>(`/api/rooms/${id}`)
      .then((res) => {
        if (read !== accessReadRef.current) return;
        setRoom((prev) => (prev ? { ...prev, role: res.data.role, invites: res.data.invites } : prev));
      })
      .catch(() => {});
  }, [api, id]);

  useEffect(() => {
    if (room?._id) loadPeople();
  }, [room?._id, loadPeople]);

  // Someone new joined (online, but not on the list yet): reload the list,
  // once per person, so it can never loop.
  const reloadedForRef = useRef(new Set<string>());
  useEffect(() => {
    if (!people) return;
    const newcomer = onlineUsers.find(
      (user) => !people.some((person) => person.userId === user.userId) && !reloadedForRef.current.has(user.userId)
    );
    if (!newcomer) return;
    reloadedForRef.current.add(newcomer.userId);
    loadPeople();
  }, [onlineUsers, people, loadPeople]);

  // Owner: who's asking to edit. Each new request gets a notice.
  function handleAccessRequests(requests: AccessRequest[]) {
    const fresh = requests.filter((request) => !knownRequestsRef.current.has(request.userId));
    knownRequestsRef.current = new Set(requests.map((request) => request.userId));
    setAccessRequests(requests);
    for (const request of fresh) toast(`${request.name} is asking to edit. Allow it on the People tab.`, "info");
  }

  function handleDismissRequest(userId: string) {
    sendAccessDismiss(userId);
    knownRequestsRef.current.delete(userId);
    setAccessRequests((prev) => prev.filter((request) => request.userId !== userId));
  }

  // Viewer: ask the owner for edit access (the button rests for a minute).
  function handleAskToEdit() {
    if (asked || canEdit) return;
    sendAccessRequest();
    setAsked(true);
    setTimeout(() => setAsked(false), 60_000);
  }

  // The owner changed your role (it already applies on the server).
  function handleRoleChange(next: RoomRole) {
    if (next !== "viewer") setAsked(false);
    setRoom((prev) => (prev ? { ...prev, role: next } : prev));
    refreshAccess();
    toast(
      next === "viewer"
        ? "You're now a viewer: you can watch, follow and chat, but not edit."
        : "You can now edit this room.",
      "info"
    );
  }

  function handleRemoved() {
    if (leavingRef.current) return;
    toast("The owner removed you from this room.", "error");
    router.replace("/dashboard");
  }

  // The room's invite links are only sent to people who may use them (the
  // owner and editors). Anyone who opens one joins with that link's role.
  async function handleResetInvite(kind: "edit" | "view") {
    try {
      const res = await api.post<{ invites: { edit: string; view: string } }>(`/api/rooms/${id}/invites`, { kind });
      setRoom((prev) => (prev ? { ...prev, invites: res.data.invites } : prev));
      toast(`New ${kind} link made. The old one no longer works.`);
    } catch {
      toast("Could not reset the link.", "error");
    }
  }

  async function handleChangeRole(userId: string, next: "editor" | "viewer") {
    try {
      await api.patch(`/api/rooms/${id}/people/${userId}`, { role: next });
      setPeople((prev) => prev?.map((person) => (person.userId === userId ? { ...person, role: next } : person)) ?? prev);
    } catch {
      toast("Could not change their role.", "error");
    }
  }

  // Removing someone also replaces both invite links, so theirs stop working.
  async function handleRemovePerson(userId: string) {
    try {
      await api.delete(`/api/rooms/${id}/people/${userId}`);
      setPeople((prev) => prev?.filter((person) => person.userId !== userId) ?? prev);
      refreshAccess();
      toast("Removed. Both invite links were replaced, so their old link no longer works.");
    } catch {
      toast("Could not remove them.", "error");
    }
  }

  async function handleLeaveRoom() {
    if (!currentUserId) return;
    leavingRef.current = true;
    try {
      await api.delete(`/api/rooms/${id}/people/${currentUserId}`);
      toast("You left the room.");
      router.replace("/dashboard");
    } catch {
      leavingRef.current = false;
      toast("Could not leave the room.", "error");
    }
  }

  // The owner starts an interview from the setup dialog.
  // (A clean editor, if asked for, is set by the server, for everyone.)
  async function handleStartInterview(choice: InterviewSetupChoice) {
    const chosen = choice.problemSlug ? getProblem(choice.problemSlug) : null;
    let started: InterviewState;
    try {
      const res = await api.post<InterviewState>("/api/interviews", {
        roomId: id,
        mode: choice.mode,
        candidateId: choice.candidateId,
        title: chosen?.title ?? choice.customTitle ?? "Interview",
        questions: [
          chosen
            ? { problemSlug: chosen.slug, minutes: choice.durationMin, starter: getProblemStarterCode(chosen, language) ?? "" }
            : { title: choice.customTitle, prompt: choice.customPrompt, minutes: choice.durationMin, starter: "" },
        ],
        durationMin: choice.durationMin,
        cleanStart: choice.cleanStart,
      });
      started = res.data;
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      throw new Error(message ?? "Couldn't start the interview.");
    }
    setSetupOpen(false);
    iv.adopt(started);
  }

  async function handleSaveScorecard(choice: ScorecardChoice) {
    if (!interview) return;
    try {
      await api.post(`/api/interviews/${interview.id}/scorecard`, choice);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      throw new Error(message ?? "Couldn't save the scorecard.");
    }
    setScorecardOpen(false);
    router.push(`/interviews/${interview.id}`);
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

  function handleTabClick(tab: SidebarTab) {
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
    if (!canEdit) return;
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
    if (next === language || !canEdit) return;
    const previous = language;

    setLanguage(next);
    setRoom((prev) => (prev ? { ...prev, language: next } : prev));
    sendLanguageChange(next);

    // Swap in the new language's starter code, but only if the editor still
    // holds the untouched starter for the previous language.
    const current = codeEditorRef.current?.getValue() ?? "";
    const nextStarter = starterFor(next);
    if (current === starterFor(previous) && current !== nextStarter) {
      codeEditorRef.current?.setValue(nextStarter);
    }
    setTestReport(null);
  }

  function starterFor(lang: string): string {
    return (problem ? getProblemStarterCode(problem, lang) : null) ?? getStarterCode(lang);
  }

    async function recordSolved(solvedProblem: Problem, solvedLanguage: string) {
    if (solvedSlugs.has(solvedProblem.slug)) {
      toast("All tests passed!");
      return;
    }
    try {
      await api.post("/api/profile/solved", { slug: solvedProblem.slug, language: solvedLanguage });
      setSolvedSlugs((prev) => new Set(prev).add(solvedProblem.slug));
      toast(`All tests passed. ${solvedProblem.title} is marked as solved!`);
    } catch {
      toast("All tests passed, but your progress couldn't be saved. Try running them again.", "error");
    }
  }

  async function handleRunTests() {
    if (!canEdit) {
      toast(VIEW_ONLY, "info");
      return;
    }
    if (testsLocked) {
      toast("Running the tests is off for this interview.", "info");
      return;
    }
    if (!problem || testsRunningRef.current) return;
    if (!isTestableLanguage(language)) {
      toast("Tests run in JavaScript, TypeScript, and Python. Switch the language to test your solution.", "info");
      return;
    }

    testsRunningRef.current = true;
    setTestsRunning(true);

    // Bring the results into view.
    if (isDesktop) {
      setZenMode(false);
      setActiveTab("problem");
    } else {
      handleMobilePanel("problem");
    }

    const runLanguage = language;
    const testedProblem = problem;
    sendRunStart(runLanguage);

    try {
      const code = codeEditorRef.current?.getValue() ?? "";
      const report = await runTests(code, runLanguage, {
        fnName: functionNameFor(testedProblem, runLanguage),
        tests: testedProblem.tests,
        compare: testedProblem.compare ?? "exact",
      });
      setTestReport(report);
      if (interviewLive && isInterviewCandidate) iv.reportTests(report.passed, report.total);
      // Everyone else in the room sees a plain-text summary in their output panel.
      sendRunResult(runLanguage, { output: report.summary, error: null, durationMs: report.durationMs });

      if (report.outcome === "completed" && report.passed === report.total) {
        await recordSolved(testedProblem, runLanguage);
      }
    } finally {
      testsRunningRef.current = false;
      setTestsRunning(false);
    }
  }

  async function handleRun() {
    if (!canEdit) return;
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

  function handleVisualize() {
    if (!canEdit) return;
    if (lensLocked) {
      toast("Lens is off for this interview.", "info");
      return;
    }
    setMobilePanel("code");
    if (!isLensLanguage(language)) {
      toast("Lens visualizes Python, JavaScript and TypeScript. Switch the room's language to try it.", "info");
      return;
    }
    void lens.run();
  }

  function handleVisualizeTest(index: number) {
    if (!problem || !canEdit || lensLocked) return;
    setMobilePanel("code");
    void lens.run({ kind: "test", index });
  }

  // What the Hotspots button does right now: show it, update stale heat, or hide it.
  const hotspotsAction = !hotspots.open
    ? "Show hotspots"
    : hotspots.stale || hotspots.error
      ? "Update hotspots"
      : "Hide hotspots";

  // Shows the heat (or refreshes it once the code changed), or hides it.
  // It shows the same kind of thing as the Big-O meter, so an interview that
  // turns the meter off turns this off too.
  function handleHotspots() {
    if (meterHidden) {
      toast("Hotspots is off for this interview.", "info");
      return;
    }
    if (!hotspots.supported) {
      toast("Hotspots works with Python, JavaScript and TypeScript. Switch the room's language to try it.", "info");
      return;
    }
    setMobilePanel("code");
    if (hotspots.open && !hotspots.running && !hotspots.stale && !hotspots.error) {
      hotspots.close();
      return;
    }
    void hotspots.run();
  }

  const isOwner = room?.ownerId === currentUserId;
  const isSelfRunning = runState.status === "running" && !!runState.runner?.isSelf;
  const showSidebar = !zenMode || !isDesktop;
  const runnable = isRunnable(language);
  const lensReady = isLensLanguage(language);
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

  const themeCommands: Command[] = [
    {
      id: "theme-auto",
      label: `Editor theme: Match the app${editorThemeAuto ? " (current)" : ""}`,
      icon: Palette,
      action: () => setEditorTheme(null),
    },
    ...EDITOR_THEMES.map((theme) => ({
      id: `theme-${theme.id}`,
      label: `Editor theme: ${theme.label}${!editorThemeAuto && theme.id === editorTheme ? " (current)" : ""}`,
      icon: Palette,
      action: () => setEditorTheme(theme.id),
    })),
  ];

  const problemCommands: Command[] = problem
    ? [
        {
          id: "run-tests",
          label: "Run tests",
          icon: FlaskConical,
          action: handleRunTests,
          disabled: !isTestableLanguage(language) || testsRunning || testsLocked,
        },
        {
          id: "show-problem",
          label: "Show problem",
          icon: BookOpen,
          action: () => {
            if (isDesktop) {
              setZenMode(false);
              setActiveTab("problem");
            } else {
              handleMobilePanel("problem");
            }
          },
        },
      ]
    : [];

  const sidebarTabs: SidebarTab[] = [
    ...(problem || customQuestion ? (["problem"] as const) : []),
    "chat",
    "online",
    ...(showInterviewTab ? (["interview"] as const) : []),
  ];

  const commands: Command[] = [
    {
      id: "run",
      label: "Run code",
      icon: Play,
      action: handleRun,
      disabled: !canEdit,
    },
    {
      id: "lens",
      label: "Visualize with Lens",
      icon: ScanEye,
      action: handleVisualize,
      disabled: !lensReady || !canEdit || lensLocked,
    },
    {
      id: "hotspots",
      label: hotspotsAction,
      icon: Flame,
      action: handleHotspots,
      disabled: !hotspots.supported || meterHidden,
    },
    ...problemCommands,
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
      disabled: !isFormattable(language) || !canEdit,
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
      id: "invite",
      label: "Invite people",
      icon: LinkIcon,
      action: () => setShareOpen(true),
      disabled: !canInvite,
    },
    {
      id: "start-interview",
      label: "Start an interview",
      icon: Timer,
      action: () => setSetupOpen(true),
      disabled: !isOwner || !!room?.interviewId || interviewOpen,
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

  // The header's "More" menu: everything that isn't Share, Run or Visualize.
  const roomMenu: MenuEntry[] = [
    {
      id: "hotspots",
      label: hotspots.open ? hotspotsAction : "Hotspots",
      icon: Flame,
      onSelect: handleHotspots,
      disabled: !hotspots.supported || meterHidden,
    },
    {
      id: "output",
      label: runPanelOpen ? "Hide output panel" : "Show output panel",
      icon: Terminal,
      onSelect: () => {
        setMobilePanel("code");
        setRunPanelOpen((o) => !o);
      },
    },
    { id: "format", label: "Format code", icon: AlignLeft, onSelect: handleFormat, disabled: !isFormattable(language) || !canEdit },
    { id: "copy", label: "Copy all code", icon: ClipboardCopy, onSelect: handleCopyCode },
    { id: "download", label: "Download code", icon: Download, onSelect: handleDownloadCode },
    ...(isDesktop
      ? [{ id: "zen", label: zenMode ? "Exit focus mode" : "Focus mode", icon: zenMode ? Minimize2 : Maximize2, onSelect: handleToggleZen }]
      : []),
    { kind: "separator", id: "people" },
    ...(canInvite ? [{ id: "invite", label: "Invite people", icon: UserPlus, onSelect: () => setShareOpen(true) }] : []),
    ...(isOwner && !room?.interviewId
      ? [{ id: "interview", label: "Start an interview", icon: Timer, onSelect: () => setSetupOpen(true), disabled: interviewOpen }]
      : []),
    ...(isOwner ? [{ id: "settings", label: "Room settings", icon: Settings, onSelect: () => setSettingsOpen(true) }] : []),
    { kind: "separator", id: "help" },
    {
      id: "theme",
      label: appTheme.theme === "dark" ? "Light theme" : "Dark theme",
      icon: appTheme.theme === "dark" ? Sun : Moon,
      onSelect: () => appTheme.choose(appTheme.theme === "dark" ? "light" : "dark"),
    },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, onSelect: openShortcutsDialog },
    { id: "commands", label: "All commands", icon: Search, onSelect: () => setCommandPaletteOpen(true), hint: "⌘K" },
  ];

  if (checking || loading) {
    return <RoomSkeleton />;
  }

  // The room couldn't be opened: deleted, or the link is wrong or was reset.
  if (notFound || !room || initialCode === null) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-ink-700 bg-ink-900">
          <Code2 className="h-5 w-5 text-ink-300" />
        </div>
        <p className="font-semibold text-ink-100">This room doesn&apos;t exist</p>
        <p className="max-w-xs text-sm text-ink-400">
          It may have been deleted, or the link is wrong or no longer works (invite links can be reset). To join
          someone else&apos;s room, ask them for a fresh invite link.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex h-9 items-center rounded-lg border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col bg-ink-950">
      {/* ---------- Header ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-950 px-2 sm:gap-3 sm:px-3 md:border-transparent">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard" className={ICON_BUTTON}>
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-semibold tracking-tight text-ink-100">{room.name}</span>
            {isOwner && (
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Room settings"
                title="Room settings"
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100 sm:flex"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span
            title={statusMeta.label}
            className={`flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${statusMeta.tone}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {statusMeta.live && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusMeta.dot}`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            </span>
            <span className="hidden sm:inline">{statusMeta.label}</span>
          </span>

          {problem && !interview && (
            <Link
              href={`/practice/${problem.slug}`}
              title={`${problem.difficulty} practice problem`}
              className="hidden shrink-0 items-center gap-1 rounded-md border border-ink-800 bg-ink-900 px-1.5 py-0.5 text-[11px] font-medium text-ink-400 transition-colors hover:border-ink-700 hover:text-ink-100 lg:inline-flex"
            >
              <BookOpen className="h-3 w-3" />
              Practice
            </Link>
          )}

          {!canEdit && (
            <span
              title={VIEW_ONLY}
              className="flex shrink-0 items-center gap-1 rounded-md border border-ink-800 bg-ink-900 px-1.5 py-0.5 text-[11px] font-medium text-ink-400"
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">View only</span>
            </span>
          )}

          {!canEdit && (
            <button
              type="button"
              onClick={handleAskToEdit}
              disabled={asked}
              title={asked ? "You've asked the owner for edit access" : "Ask the owner for edit access"}
              className="hidden h-7 shrink-0 items-center rounded-md bg-ink-100 px-2.5 text-xs font-medium text-ink-950 transition-colors hover:bg-ink-200 disabled:bg-ink-800 disabled:text-ink-500 sm:flex"
            >
              {asked ? "Asked" : "Ask to edit"}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <PresenceStack users={onlineUsers} currentUserId={currentUserId ?? null} />
          </div>

          {canInvite && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              title="Invite people"
              aria-label="Invite people"
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs font-medium text-ink-200 shadow-xs transition-colors hover:border-ink-600 hover:bg-ink-950 hover:text-ink-100 sm:flex"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Share
            </button>
          )}

          <LanguageDropdown
            value={language}
            onChange={handleLanguageChange}
            disabled={!canEdit}
            disabledReason={VIEW_ONLY}
          />

          <button
            onClick={handleRun}
            disabled={isSelfRunning || !canEdit}
            title={
              !canEdit ? VIEW_ONLY : runnable ? "Run (⌘↵)" : `Running ${languageLabel(language)} isn't supported yet`
            }
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              runnable
                ? "bg-ink-100 text-ink-950 hover:bg-ink-200"
                : "border border-ink-700 bg-ink-900 text-ink-400 hover:border-ink-600"
            }`}
          >
            {isSelfRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
            {runnable && (
              <kbd className="ml-0.5 hidden font-[family-name:var(--font-mono)] text-[10px] text-ink-950/60 lg:inline">⌘↵</kbd>
            )}
          </button>

          <button
            type="button"
            onClick={handleHotspots}
            disabled={!hotspots.supported || meterHidden}
            aria-label={hotspotsAction}
            aria-pressed={hotspots.open}
            title={
              meterHidden
                ? "Hotspots is off for this interview"
                : !hotspots.supported
                  ? "Hotspots works with Python, JavaScript and TypeScript"
                  : hotspots.open
                    ? hotspotsAction
                    : "Hotspots: see how many times every line runs"
            }
            className={`hidden h-8 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs font-medium text-ink-200 shadow-xs transition-colors hover:border-ink-600 hover:bg-ink-950 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-50 sm:flex ${
              hotspots.open ? "hs-active" : ""
            }`}
          >
            {hotspots.running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Flame className="h-3.5 w-3.5" style={hotspots.open ? { color: "var(--hs-7)" } : undefined} />
            )}
            <span className="hidden lg:inline">Hotspots</span>
          </button>

          <button
            onClick={handleVisualize}
            disabled={lens.recording || !canEdit || lensLocked}
            aria-label="Visualize with Lens"
            title={
              lensLocked
                ? "Lens is off for this interview"
                : !canEdit
                  ? VIEW_ONLY
                  : !lensReady
                    ? "Lens visualizes Python, JavaScript and TypeScript"
                    : lens.practice
                      ? `Visualize ${lens.practice.next} with Lens`
                      : "Visualize with Lens: watch the code run, step by step"
            }
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-xs transition-colors disabled:opacity-60 ${
              canEdit ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"
            } ${
              lensReady
                ? "border-ink-700 bg-ink-900 text-ink-200 hover:border-ink-600 hover:bg-ink-950 hover:text-ink-100"
                : "border-ink-800 bg-ink-900 text-ink-500 hover:border-ink-700"
            }`}
          >
            {lens.recording ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanEye className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">Visualize</span>
          </button>

          <Menu
            label="More actions"
            icon={<Ellipsis className="h-4 w-4" />}
            entries={roomMenu}
            triggerClassName="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 text-ink-400 shadow-xs transition-colors hover:border-ink-600 hover:bg-ink-950 hover:text-ink-100"
          />
        </div>
      </header>

      {interview && (
        <InterviewBar
          interview={interview}
          skew={iv.skew}
          me={currentUserId ?? null}
          hintCount={kit?.hints.length ?? 3}
          onControl={iv.control}
          onDone={iv.done}
          onScorecard={() => setScorecardOpen(true)}
        />
      )}

      {/* ---------- Body: floating panels on desktop, full-bleed on phones ---------- */}
      <div className="flex min-h-0 flex-1 md:px-2 md:pb-2">
        <div
          className={`${mobilePanel === "code" ? "flex" : "hidden"} min-w-0 flex-1 flex-col bg-ink-900 md:flex md:overflow-hidden md:rounded-xl md:border md:border-ink-800`}
        >
          {hotspots.open && <HotspotsBar hotspots={hotspots} onReveal={(line) => revealLine(getMonaco(), line)} />}
          <div
            className="relative min-h-0 flex-1 transition-[padding] duration-300"
            style={hotspots.open && hotspots.result && isDesktop ? { paddingRight: HOTSPOTS_LANE_WIDTH } : undefined}
          >
            <CodeEditor
              handleRef={codeEditorRef}
              language={language}
              initialValue={initialCode}
              onChange={handleCodeChange}
              onRemoteChange={() => {
                meterChangedRef.current();
                hotspots.notifyChange();
              }}
              onRunShortcut={handleRun}
              onSendSelection={handleSendSelectionToChat}
              collab={collab.session}
              collabReady={collab.synced}
              collabGeneration={collab.generation}
              viewOnly={!canEdit || lobbyLocked}
              followUserId={followed ? followed.userId : null}
              onStopFollowing={() => setFollowing(null)}
              saveStatus={saveStatus}
              minimapEnabled={minimapEnabled}
              fontSize={fontSize}
              wordWrap={wordWrap}
              onToggleWordWrap={handleToggleWordWrap}
              themeId={editorTheme}
              onThemeChange={setEditorTheme}
            />
            {hotspots.open && hotspots.result && isDesktop && (
              <HotspotsLane getEditor={getMonaco} result={hotspots.result} stale={hotspots.stale} />
            )}
            {followed && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-ink-700 bg-ink-900/95 py-1 pl-1.5 pr-1 text-xs text-ink-300 shadow-raised backdrop-blur">
                  <AvatarIcon avatarId={followed.avatarId} className="h-5 w-5 rounded-full" />
                  <span>
                    Following <span className="font-semibold text-ink-100">{followed.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFollowing(null)}
                    className="rounded-md px-2 py-0.5 font-medium text-ink-100 transition-colors hover:bg-ink-800"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
            {!meterHidden && <ComplexityMeter meter={meter} />}
            <RoomLens lens={lens} />
            {interview?.status === "scheduled" && (
              <InterviewLobby
                interview={interview}
                me={currentUserId ?? null}
                onlineIds={new Set(onlineUsers.map((user) => user.userId))}
                onStart={() => iv.control("start")}
                onConsent={() => iv.monitor("consent")}
              />
            )}
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
                <div className="relative flex rounded-lg border border-ink-800 bg-ink-950 p-0.5">
                  {sidebarTabs.map((tab) => {
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
                            className="absolute inset-0 rounded-md bg-ink-900 shadow-xs ring-1 ring-ink-800"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                          />
                        )}
                        <span
                          className={`relative z-10 inline-flex items-center justify-center gap-1.5 transition-colors ${
                            active ? "text-ink-100" : "text-ink-500 hover:text-ink-100"
                          }`}
                        >
                          {SIDEBAR_TAB_LABELS[tab]}
                          {tab === "online" && (
                            <span className="rounded border border-ink-700 bg-ink-900 px-1 text-[10px] tabular-nums text-ink-300">
                              {onlineUsers.length}
                            </span>
                          )}
                          {tab === "online" && accessRequests.length > 0 && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-ink-100"
                              title="Someone is asking to edit"
                              aria-label="Someone is asking to edit"
                            />
                          )}
                          {tab === "chat" && unreadCount > 0 && !active && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-danger-strong px-1 text-[9px] font-bold text-white">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === "problem" && customQuestion && interview ? (
                <QuestionPanel question={customQuestion} total={interview.questions.length} events={interview.events} />
              ) : activeTab === "problem" && problem ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {interview && question && question.hintsGiven > 0 && (
                    <div className="max-h-56 shrink-0 overflow-y-auto border-b border-ink-800 px-4 py-3">
                      <GivenHints
                        hints={interviewHints}
                        given={question.hintsGiven}
                        events={interview.events}
                        question={interview.current}
                      />
                    </div>
                  )}
                  <ProblemPanel
                    problem={problem}
                    language={language}
                    report={testReport}
                    running={testsRunning}
                    solved={solvedSlugs.has(problem.slug)}
                    onRunTests={handleRunTests}
                    onVisualizeTest={lensReady ? handleVisualizeTest : undefined}
                  />
                </div>
              ) : activeTab === "interview" && interview && isInterviewer ? (
                <InterviewerPanel
                  interview={interview}
                  notes={iv.notes}
                  kit={kit}
                  candidateOnline={onlineUsers.some((user) => user.userId === interview.candidate?.userId)}
                  onGiveHint={(text) => iv.control("hint", text ? { text } : {})}
                  onGoto={(index) => iv.control("goto", { index })}
                  onAddNote={iv.addNote}
                />
              ) : activeTab === "online" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <PeoplePanel
                    people={people}
                    onlineUsers={onlineUsers}
                    currentUserId={currentUserId ?? null}
                    myRole={role}
                    following={following}
                    onFollow={(userId) => {
                      setFollowing(userId);
                      if (!isDesktop) handleMobilePanel("code");
                    }}
                    onChangeRole={handleChangeRole}
                    onRemove={handleRemovePerson}
                    onLeave={handleLeaveRoom}
                    onInvite={canInvite ? () => setShareOpen(true) : undefined}
                    requests={isOwner ? accessRequests : []}
                    onAllow={(userId) => void handleChangeRole(userId, "editor")}
                    onDismiss={handleDismissRequest}
                    onAskToEdit={!canEdit ? handleAskToEdit : undefined}
                    asked={asked}
                  />

                  {canInvite && (people?.length ?? onlineUsers.length) <= 1 && (
                    <div className="mx-2 mb-2 rounded-xl border border-dashed border-ink-700 bg-ink-950/50 p-4 text-center">
                      <p className="text-sm font-medium text-ink-100">You&apos;re the only one here</p>
                      <p className="mt-1 text-xs text-ink-400">Invite people to code together, or just to watch.</p>
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-3.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-ink-200 active:scale-[0.98]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite people
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
        {MOBILE_TABS.filter(
          (tab) =>
            (tab.id !== "problem" || !!problem || !!customQuestion) && (tab.id !== "interview" || showInterviewTab)
        ).map(({ id: tabId, label, icon: Icon }) => {
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
                  <span className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-danger-strong px-1 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {tabId === "online" && accessRequests.length > 0 && (
                  <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-ink-100" />
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
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={room._id}
        invites={room.invites}
        canReset={isOwner}
        onReset={handleResetInvite}
      />
      <InterviewSetup
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        me={currentUserId ?? null}
        language={language}
        people={people ?? []}
        onlineIds={new Set(onlineUsers.map((user) => user.userId))}
        editLink={room.invites ? `${typeof window !== "undefined" ? window.location.origin : ""}/room/${room._id}?invite=${room.invites.edit}` : null}
        onStart={handleStartInterview}
      />
      {interview && (
        <>
          <InterviewOverlays
            interview={interview}
            skew={iv.skew}
            me={currentUserId ?? null}
            hints={interviewHints}
            onControl={(action) => iv.control(action)}
          />
          <Scorecard
            open={scorecardOpen && isInterviewer && interview.status === "ended"}
            interview={interview}
            canShare={interview.organizerId === currentUserId}
            onClose={() => setScorecardOpen(false)}
            onSave={handleSaveScorecard}
          />
        </>
      )}
    </main>
  );
}