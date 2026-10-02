"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { traceCode, type TestRunReport } from "@/lib/execution";
import type { LensTrace } from "@/lib/lens";
import {
  buildCallProgram,
  defaultCallable,
  findCallables,
  isIdleTrace,
  lensErrorHint,
  type LensCallable,
} from "@/lib/lensCall";
import { buildChoiceProgram, defaultChoice, formatArgs, parseCustomArgs, type LensChoice } from "@/lib/lensPractice";
import { LENS_SHARE_MAX_CODE, packTrace, unpackTrace } from "@/lib/lensShare";
import { functionNameFor, type Problem } from "@/lib/problems";
import type { LensDriver, LensDriverEvent, LensSessionEvent, LensStepEvent, LensStopEvent } from "@/types/roomEvents";

// A room's Lens session. Whoever clicks Visualize records the run in their
// browser and shares the recording (compressed) through the server, so
// everyone watches exactly the same thing. The driver's step is shared;
// everyone else follows it until they step around on their own.

export type RoomLensSession = {
  id: string;
  title: string;
  code: string;
  trace: LensTrace;
  driver: LensDriver | null;
  // False when the recording couldn't be shared (too big, or an older
  // browser): only you can see it.
  shared: boolean;
};

export type LensSenders = {
  start: (session: { id: string; title: string; code: string; trace: Uint8Array }) => void;
  step: (id: string, step: number) => void;
  drive: (id: string, step: number) => void;
  stop: (id: string) => void;
};

// What the room is working on, read when Visualize is pressed.
export type RoomLensContext = {
  language: string;
  getCode: () => string;
  // Practice rooms: the problem, and the last test run (if any).
  problem: Problem | null;
  report: TestRunReport | null;
};

// A recording in which nothing ran (the code only defines things). It isn't
// shared; the person who recorded it gets a box to add a call instead.
export type RoomLensIdle = {
  code: string;
  language: string;
  trace: LensTrace;
  callables: LensCallable[];
  defaultCall: string;
};

type Notify = (message: string, tone?: "error" | "info") => void;
type Position = { id: string; step: number };
type VisualizeInput = {
  code: string;
  language?: string;
  title?: string;
  setup?: string;
  // Plain code: if nothing runs, offer the call box instead of sharing.
  checkIdle?: boolean;
  // Practice: the function the tests call, for a clearer error if it's renamed.
  fnName?: string;
};

// At most one step update per this many milliseconds while scrubbing.
const STEP_SEND_MS = 60;

function clampStep(step: number, trace: LensTrace) {
  return Math.max(0, Math.min(trace.steps.length - 1, Math.floor(step)));
}

function newSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function validDriver(driver: unknown): LensDriver | null {
  if (!driver || typeof driver !== "object") return null;
  const d = driver as Partial<LensDriver>;
  return typeof d.userId === "string" && typeof d.name === "string" && typeof d.avatarId === "string"
    ? { userId: d.userId, name: d.name, avatarId: d.avatarId }
    : null;
}

function choiceText(choice: LensChoice, report: TestRunReport | null): string {
  if (choice.kind === "custom") return "your custom input";
  if (choice.kind === "code") return "just your code";
  const status = report?.results[choice.index]?.status;
  return `Test ${choice.index + 1}${status === "failed" || status === "error" ? " (failing)" : ""}`;
}

export function useRoomLens({
  me,
  send,
  notify,
  context,
  canDrive = true,
}: {
  me: LensDriver | null;
  send: LensSenders;
  notify: Notify;
  context?: RoomLensContext;
  // Viewers can follow the driver or step on their own, but not take over.
  canDrive?: boolean;
}) {
  const [session, setSession] = useState<RoomLensSession | null>(null);
  // Where the driver is. Everyone following shows this step.
  const [position, setPosition] = useState<Position | null>(null);
  // Where you are after stepping away from the driver.
  const [ownStep, setOwnStep] = useState(0);
  const [following, setFollowing] = useState(true);
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingLanguage, setRecordingLanguage] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [idle, setIdle] = useState<RoomLensIdle | null>(null);
  // Practice: what you last picked. It only counts until the next test run,
  // after which Visualize goes back to the first failing test.
  const [picked, setPicked] = useState<{ choice: LensChoice; report: TestRunReport | null } | null>(null);
  const [customTexts, setCustomTexts] = useState<string[] | null>(null);

  const sessionRef = useRef<RoomLensSession | null>(null);
  const sendRef = useRef(send);
  const contextRef = useRef(context);
  const recordingRef = useRef(false);
  // The newest session id, so a slow unpack can't overwrite a newer session.
  const latestIdRef = useRef<string | null>(null);
  // A step that arrived while its session was still unpacking.
  const pendingStepRef = useRef<Position | null>(null);
  const queuedStepRef = useRef<Position | null>(null);
  const sendTimerRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    sendRef.current = send;
    contextRef.current = context;
  });

  useEffect(
    () => () => {
      if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current);
    },
    [],
  );

  const isDriver = !!session && (!session.shared || (!!me && session.driver?.userId === me.userId));
  const sharedStep = session && position?.id === session.id ? position.step : 0;
  const step = isDriver || following ? sharedStep : ownStep;

  // Coalesces rapid step changes (scrubbing, fast playback) into one message
  // per STEP_SEND_MS, always ending on the latest step.
  const queueStep = useCallback((id: string, next: number) => {
    queuedStepRef.current = { id, step: next };
    if (sendTimerRef.current !== null) return;
    const wait = Math.max(0, STEP_SEND_MS - (Date.now() - lastSentRef.current));
    sendTimerRef.current = window.setTimeout(() => {
      sendTimerRef.current = null;
      const queued = queuedStepRef.current;
      queuedStepRef.current = null;
      if (!queued) return;
      lastSentRef.current = Date.now();
      sendRef.current.step(queued.id, queued.step);
    }, wait);
  }, []);

  // ---------- Actions ----------

  const startSession = useCallback(
    async ({ code, title, trace }: { code: string; title: string; trace: LensTrace }) => {
      const id = newSessionId();
      let shared = false;
      if (me && code.length <= LENS_SHARE_MAX_CODE) {
        const packed = await packTrace(trace);
        if (packed) {
          sendRef.current.start({ id, title, code, trace: packed });
          shared = true;
        }
      }

      latestIdRef.current = id;
      setSession({ id, title, code, trace, driver: me, shared });
      setPosition({ id, step: 0 });
      setOwnStep(0);
      setFollowing(true);
      setOpen(true);
      if (!shared) notify("This recording couldn't be shared with the room, so only you can see it.", "info");
    },
    [me, notify],
  );

  // Records a program and shares it. Returns true when a session started.
  const visualize = useCallback(
    async (input: VisualizeInput): Promise<boolean> => {
      if (recordingRef.current) return false;
      const language = input.language ?? "python";
      recordingRef.current = true;
      setRecording(true);
      setRecordingLanguage(language);
      setRecordingTitle(input.title ?? "");
      try {
        const result = await traceCode(language, input.code, { setup: input.setup });
        if (!result.ok) {
          notify(result.error, "error");
          return false;
        }
        const trace = result.trace;
        if (trace.steps.length === 0) {
          const problem = trace.error;
          const hint = problem ? lensErrorHint(problem.message, language, input.fnName) : null;
          notify(
            problem
              ? `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}${hint ? ` ${hint}` : ""}`
              : "There's nothing to visualize yet.",
            "error",
          );
          return false;
        }

        if (input.checkIdle && isIdleTrace(trace)) {
          const callables = findCallables(trace, input.code, language);
          setIdle({
            code: input.code,
            language,
            trace,
            callables,
            defaultCall: defaultCallable(callables)?.template ?? "",
          });
          return false;
        }

        const hint = trace.error ? lensErrorHint(trace.error.message, language, input.fnName) : null;
        if (hint) notify(hint, "info");
        setIdle(null);
        await startSession({ code: input.code, title: input.title ?? "", trace });
        return true;
      } finally {
        recordingRef.current = false;
        setRecording(false);
        setRecordingLanguage(null);
        setRecordingTitle("");
      }
    },
    [notify, startSession],
  );

  // The Visualize button. In a Practice room it runs a test (the one you
  // picked, else the first failing one, else Test 1); elsewhere it runs the
  // code as it is.
  const run = useCallback(
    async (choice?: LensChoice) => {
      const ctx = contextRef.current;
      if (!ctx) return;
      const code = ctx.getCode();
      if (!ctx.problem) {
        await visualize({ code, language: ctx.language, title: "", checkIdle: true });
        return;
      }
      if (choice) setPicked({ choice, report: ctx.report });
      const active =
        choice ?? (picked && picked.report === ctx.report ? picked.choice : null) ?? defaultChoice(ctx.report);
      const program = buildChoiceProgram(ctx.problem, code, active, ctx.language);
      if (!program) return;
      await visualize({
        ...program,
        checkIdle: active.kind === "code",
        fnName: functionNameFor(ctx.problem, ctx.language),
      });
    },
    [picked, visualize],
  );

  // Practice: the custom-input boxes. Returns the problems with the input,
  // or null once it's recording.
  const submitCustom = useCallback(
    (texts: string[]): (string | null)[] | null => {
      const problem = contextRef.current?.problem;
      if (!problem) return null;
      const parsed = parseCustomArgs(problem, texts);
      if (!parsed.ok) return parsed.errors;
      setCustomTexts(texts);
      void run({ kind: "custom", args: parsed.args });
      return null;
    },
    [run],
  );

  // The call box, when nothing ran.
  const submitCall = useCallback(
    async (call: string) => {
      if (!idle || !call.trim()) return;
      await visualize(buildCallProgram(idle.code, idle.language, call));
    },
    [idle, visualize],
  );

  const showIdleAnyway = useCallback(async () => {
    if (!idle) return;
    setIdle(null);
    await startSession({ code: idle.code, title: "", trace: idle.trace });
  }, [idle, startSession]);

  const dismissIdle = () => setIdle(null);

  const changeStep = (next: number) => {
    if (!session) return;
    const target = clampStep(next, session.trace);
    if (isDriver) {
      setPosition({ id: session.id, step: target });
      if (session.shared) queueStep(session.id, target);
    } else {
      // Stepping on your own stops following the driver.
      setFollowing(false);
      setOwnStep(target);
    }
  };

  const follow = () => setFollowing(true);

  const takeControl = () => {
    if (!session || !session.shared || !me || !canDrive) return;
    sendRef.current.drive(session.id, step);
    setSession({ ...session, driver: me });
    setPosition({ id: session.id, step });
    setFollowing(true);
  };

  // The driver ends the session for everyone.
  const end = () => {
    if (!session) return;
    if (session.shared && isDriver) sendRef.current.stop(session.id);
    latestIdRef.current = null;
    setSession(null);
    setPosition(null);
    setOpen(false);
  };

  const hide = () => setOpen(false);

  const show = () => {
    setOpen(true);
    setFollowing(true);
  };

  // ---------- Practice: what the test picker shows ----------

  const problem = context?.problem ?? null;
  const report = context?.report ?? null;
  const nextChoice = problem
    ? ((picked && picked.report === report ? picked.choice : null) ?? defaultChoice(report))
    : null;
  const defaultTest = defaultChoice(report).index;
  const practice =
    problem && nextChoice
      ? {
          tests: problem.tests.map((_, index) => {
            const status = report?.results[index]?.status;
            return { index, status: status && status !== "not-run" ? status : null };
          }),
          params: problem.params,
          // What Visualize will show next, e.g. "Test 2 (failing)".
          next: choiceText(nextChoice, report),
          defaultTest,
          customTexts:
            customTexts ?? formatArgs(problem.tests[nextChoice.kind === "test" ? nextChoice.index : defaultTest].args),
          choose: (choice: LensChoice) => void run(choice),
          submitCustom,
        }
      : null;

  // ---------- Events from the room ----------

  const receiveSession = useCallback(async (event: LensSessionEvent) => {
    if (!event || typeof event.id !== "string") return;
    latestIdRef.current = event.id;
    const trace = await unpackTrace(event.trace);
    // A newer session may have arrived while this one was unpacking.
    if (latestIdRef.current !== event.id || !trace || trace.steps.length === 0) return;
    const pending = pendingStepRef.current;
    const start = pending && pending.id === event.id ? pending.step : Number(event.step) || 0;
    setSession({
      id: event.id,
      title: typeof event.title === "string" ? event.title : "",
      code: typeof event.code === "string" ? event.code : "",
      trace,
      driver: validDriver(event.driver),
      shared: true,
    });
    setPosition({ id: event.id, step: clampStep(start, trace) });
    setFollowing(true);
    // A session that was just started opens for everyone; one you're
    // catching up on after joining waits behind the banner.
    if (event.fresh) setOpen(true);
  }, []);

  const receiveStep = useCallback((event: LensStepEvent) => {
    if (!event || typeof event.id !== "string" || typeof event.step !== "number") return;
    pendingStepRef.current = { id: event.id, step: event.step };
    setPosition((prev) => (prev && prev.id === event.id ? { id: prev.id, step: event.step } : prev));
  }, []);

  const receiveDriver = useCallback((event: LensDriverEvent) => {
    if (!event || typeof event.id !== "string") return;
    setSession((prev) => (prev && prev.id === event.id ? { ...prev, driver: validDriver(event.driver) } : prev));
    if (typeof event.step === "number") {
      setPosition((prev) => (prev && prev.id === event.id ? { id: prev.id, step: event.step } : prev));
    }
    // Whoever has the wheel now, everyone else follows them.
    setFollowing(true);
  }, []);

  const receiveStop = useCallback(
    (event: LensStopEvent) => {
      const current = sessionRef.current;
      if (!current || !event || current.id !== event.id) return;
      latestIdRef.current = null;
      setSession(null);
      setPosition(null);
      setOpen(false);
      notify("The Lens session ended.", "info");
    },
    [notify],
  );

  return {
    session,
    open,
    recording,
    recordingLanguage,
    recordingTitle,
    following,
    isDriver,
    canDrive,
    step,
    idle,
    practice,
    visualize,
    run,
    submitCall,
    showIdleAnyway,
    dismissIdle,
    changeStep,
    follow,
    takeControl,
    end,
    hide,
    show,
    receiveSession,
    receiveStep,
    receiveDriver,
    receiveStop,
  };
}

export type RoomLensState = ReturnType<typeof useRoomLens>;
export type RoomLensPractice = NonNullable<RoomLensState["practice"]>;