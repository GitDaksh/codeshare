"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { traceCode } from "@/lib/execution";
import type { LensTrace } from "@/lib/lens";
import { LENS_SHARE_MAX_CODE, packTrace, unpackTrace } from "@/lib/lensShare";
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

type Notify = (message: string, tone?: "error" | "info") => void;
type Position = { id: string; step: number };

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

export function useRoomLens({ me, send, notify }: { me: LensDriver | null; send: LensSenders; notify: Notify }) {
  const [session, setSession] = useState<RoomLensSession | null>(null);
  // Where the driver is. Everyone following shows this step.
  const [position, setPosition] = useState<Position | null>(null);
  // Where you are after stepping away from the driver.
  const [ownStep, setOwnStep] = useState(0);
  const [following, setFollowing] = useState(true);
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingLanguage, setRecordingLanguage] = useState<string | null>(null);

  const sessionRef = useRef<RoomLensSession | null>(null);
  const sendRef = useRef(send);
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

  const visualize = useCallback(
    async (input: { code: string; language?: string; title?: string; setup?: string }) => {
      if (recordingRef.current) return;
      const language = input.language ?? "python";
      recordingRef.current = true;
      setRecording(true);
      setRecordingLanguage(language);
      try {
        const result = await traceCode(language, input.code, { setup: input.setup });
        if (!result.ok) {
          notify(result.error, "error");
          return;
        }
        const trace = result.trace;
        if (trace.steps.length === 0) {
          const problem = trace.error;
          notify(
            problem
              ? `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}`
              : "There's nothing to visualize yet.",
            "error",
          );
          return;
        }

        const id = newSessionId();
        const title = input.title ?? "";
        let shared = false;
        if (me && input.code.length <= LENS_SHARE_MAX_CODE) {
          const packed = await packTrace(trace);
          if (packed) {
            sendRef.current.start({ id, title, code: input.code, trace: packed });
            shared = true;
          }
        }

        latestIdRef.current = id;
        setSession({ id, title, code: input.code, trace, driver: me, shared });
        setPosition({ id, step: 0 });
        setOwnStep(0);
        setFollowing(true);
        setOpen(true);
        if (!shared) notify("This recording couldn't be shared with the room, so only you can see it.", "info");
      } finally {
        recordingRef.current = false;
        setRecording(false);
        setRecordingLanguage(null);
      }
    },
    [me, notify],
  );

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
    if (!session || !session.shared || !me) return;
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
    following,
    isDriver,
    step,
    visualize,
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