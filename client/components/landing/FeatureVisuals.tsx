"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { AlignLeft, Check, Link as LinkIcon, Maximize2, Play } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DEMO_AVATARS } from "@/components/landing/demoAvatars";

// Steps through a loop only while the visual is on screen. With reduced
// motion it sits on a representative finished frame instead.
function useLoop(steps: number, intervalMs: number, restStep = steps - 1) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % steps), intervalMs);
    return () => clearInterval(timer);
  }, [inView, reduce, steps, intervalMs]);

  return { ref, step: reduce ? restStep : step };
}

// ---------- Real-time editing ----------

const SYNC_TEXT = "let total = a + b;";

function MiniPane({ name, avatar, text }: { name: string; avatar: string; text: string }) {
  return (
    <div className="w-full min-w-0 max-w-[220px] overflow-hidden rounded-lg border border-ink-800 bg-ink-900/80">
      <div className="flex items-center gap-1.5 border-b border-ink-800 px-2.5 py-1.5">
        <AvatarIcon avatarId={avatar} className="h-3.5 w-3.5 rounded-full" />
        <span className="truncate text-[10px] text-ink-400">{name}&apos;s screen</span>
      </div>
      <div className="px-2.5 py-2 font-[family-name:var(--font-mono)] text-[10px] leading-5 sm:text-[11px]">
        <div className="flex gap-2 text-ink-600">
          <span>1</span>
          <span>{"// shared.js"}</span>
        </div>
        <div className="flex gap-2 whitespace-pre">
          <span className="text-ink-600">2</span>
          <span className="text-ink-300">
            {text}
            <span className="ml-px inline-block h-3 w-[2px] translate-y-0.5 bg-ink-100" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function SyncVisual() {
  const { ref, step } = useLoop(SYNC_TEXT.length + 22, 80);
  const typed = Math.min(step, SYNC_TEXT.length);

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center gap-3 px-5 sm:gap-4">
      <MiniPane name="priya" avatar={DEMO_AVATARS.priya} text={SYNC_TEXT.slice(0, typed)} />
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ink-100" />
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-ink-600">
          live
        </span>
      </div>
      <MiniPane
        name="arjun"
        avatar={DEMO_AVATARS.arjun}
        text={SYNC_TEXT.slice(0, Math.max(0, typed - 1))}
      />
    </div>
  );
}

// ---------- Live presence ----------

const CROWD = [DEMO_AVATARS.priya, DEMO_AVATARS.arjun, DEMO_AVATARS.sam, DEMO_AVATARS.maya, DEMO_AVATARS.leo];
const CROWD_COUNTS = [2, 3, 4, 5, 5, 4, 3];

export function PresenceVisual() {
  const { ref, step } = useLoop(CROWD_COUNTS.length, 1100);
  const count = CROWD_COUNTS[step];

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div className="flex -space-x-2.5">
        <AnimatePresence initial={false}>
          {CROWD.slice(0, count).map((seed) => (
            <motion.div
              key={seed}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="rounded-full ring-4 ring-ink-950"
            >
              <AvatarIcon avatarId={seed} className="h-10 w-10 rounded-full" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-100" />
        {count} people online
      </p>
    </div>
  );
}

// ---------- Built-in chat ----------

const CHAT_LINES: { avatar: string; name: string; text: ReactNode }[] = [
  { avatar: DEMO_AVATARS.priya, name: "priya", text: "why is this O(n²)?" },
  { avatar: DEMO_AVATARS.arjun, name: "arjun", text: "nested loop on line 4" },
  {
    avatar: DEMO_AVATARS.priya,
    name: "priya",
    text: (
      <>
        ahh,{" "}
        <code className="rounded bg-ink-800 px-1 font-[family-name:var(--font-mono)] text-[0.9em] text-ink-100">
          Map
        </code>{" "}
        it is
      </>
    ),
  },
];

export function ChatVisual() {
  const { ref, step } = useLoop(6, 1100);
  const count = Math.min(step, CHAT_LINES.length);

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col justify-end gap-2.5 px-5 pb-5">
      <AnimatePresence initial={false}>
        {CHAT_LINES.slice(0, count).map((m, i) => (
          <motion.div
            key={i}
            layout="position"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2"
          >
            <AvatarIcon avatarId={m.avatar} className="h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-ink-300">{m.name}</p>
              <p className="text-xs text-ink-400">{m.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------- Shared runs ----------

function RunLine({ show, className, children }: { show: boolean; className?: string; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0, x: show ? 0 : -6 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RunVisual() {
  const { ref, step } = useLoop(9, 600);

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center px-5">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-ink-800 bg-ink-900/80 font-[family-name:var(--font-mono)] text-[11px] sm:text-xs">
        <div className="flex items-center justify-between border-b border-ink-800 px-3 py-1.5 text-[10px] text-ink-500">
          <span className="uppercase tracking-wide">Output</span>
          <span className="flex items-center gap-1">
            <Play className="h-2.5 w-2.5" />
            ⌘↵
          </span>
        </div>
        <div className="space-y-1 px-3 py-2.5">
          <RunLine show={step >= 1} className="text-ink-400">
            $ run twoSum.js
          </RunLine>
          <RunLine show={step >= 2} className="text-ink-100">
            [0, 1]
          </RunLine>
          <RunLine show={step >= 3} className="text-ink-500">
            ✓ finished in 14ms
          </RunLine>
          <RunLine show={step >= 4} className="flex items-center gap-2 pt-1 text-ink-500">
            <span className="flex -space-x-1.5">
              {[DEMO_AVATARS.priya, DEMO_AVATARS.arjun, DEMO_AVATARS.sam].map((seed) => (
                <AvatarIcon key={seed} avatarId={seed} className="h-4 w-4 rounded-full ring-2 ring-ink-900" />
              ))}
            </span>
            shared with everyone in the room
          </RunLine>
        </div>
      </div>
    </div>
  );
}

// ---------- Keyboard-first ----------

const PALETTE_ITEMS = [
  { label: "Run code", icon: Play, hint: "⌘↵" },
  { label: "Format code", icon: AlignLeft, hint: "" },
  { label: "Copy room link", icon: LinkIcon, hint: "" },
  { label: "Enter focus mode", icon: Maximize2, hint: "" },
];

export function PaletteVisual() {
  const { ref, step } = useLoop(PALETTE_ITEMS.length, 1300, 0);

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center px-5">
      <div className="w-full max-w-xs overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2">
          <kbd className="rounded border border-ink-700 px-1.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-400">
            ⌘K
          </kbd>
          <span className="text-xs text-ink-600">Type a command…</span>
        </div>
        <div className="p-1">
          {PALETTE_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = i === step;
            return (
              <div key={item.label} className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs">
                {active && (
                  <motion.div
                    layoutId="landing-palette-highlight"
                    className="absolute inset-0 rounded-md bg-ink-800"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className={`relative h-3.5 w-3.5 ${active ? "text-ink-100" : "text-ink-600"}`} />
                <span className={`relative ${active ? "text-ink-100" : "text-ink-400"}`}>{item.label}</span>
                {item.hint && (
                  <span className="relative ml-auto font-[family-name:var(--font-mono)] text-[10px] text-ink-600">
                    {item.hint}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- One link to join ----------

export function ShareVisual() {
  const { ref, step } = useLoop(6, 1000, 3);
  const copied = step >= 1 && step <= 4;
  const joined = step >= 2 && step <= 4;

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5">
      <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/80 p-1.5 pl-3">
        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-500" />
        <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-mono)] text-[11px] text-ink-400">
          codeshare-nexus.vercel.app/room/6ab1f2…
        </span>
        <motion.span
          animate={{ scale: step === 1 ? 0.94 : 1 }}
          transition={{ duration: 0.12 }}
          className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
            copied ? "bg-ink-100 text-ink-950" : "bg-ink-800 text-ink-300"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            "Copy"
          )}
        </motion.span>
      </div>
      <div className="h-9">
        <AnimatePresence>
          {joined && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900 py-1 pl-1 pr-3 text-xs text-ink-300"
            >
              <AvatarIcon avatarId={DEMO_AVATARS.sam} className="h-6 w-6 rounded-full" />
              sam joined the room
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}