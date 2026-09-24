"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Loader2, Play } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DEMO_AVATARS } from "@/components/landing/demoAvatars";

type Author = "priya" | "arjun";
type Token = [text: string, className: string];
type CodeLine = { author: Author; tokens: Token[] };

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

// Grayscale "syntax highlighting"
const KW = "font-semibold text-ink-100";
const FN = "text-ink-100";
const ID = "text-ink-300";
const PU = "text-ink-500";
const NU = "text-ink-400";

const LINES: CodeLine[] = [
  {
    author: "priya",
    tokens: [["function", KW], [" ", PU], ["twoSum", FN], ["(", PU], ["nums", ID], [", ", PU], ["target", ID], [") {", PU]],
  },
  {
    author: "priya",
    tokens: [["  ", PU], ["const", KW], [" seen ", ID], ["= ", PU], ["new", KW], [" ", PU], ["Map", FN], ["();", PU]],
  },
  {
    author: "arjun",
    tokens: [
      ["  ", PU], ["for", KW], [" (", PU], ["let", KW], [" i ", ID], ["= ", PU], ["0", NU], ["; ", PU],
      ["i", ID], [" < ", PU], ["nums", ID], [".", PU], ["length", ID], ["; ", PU], ["i", ID], ["++) {", PU],
    ],
  },
  {
    author: "arjun",
    tokens: [
      ["    ", PU], ["const", KW], [" need ", ID], ["= ", PU], ["target", ID], [" - ", PU],
      ["nums", ID], ["[", PU], ["i", ID], ["];", PU],
    ],
  },
  {
    author: "arjun",
    tokens: [["    ", PU], ["if", KW], [" (", PU], ["seen", ID], [".", PU], ["has", FN], ["(", PU], ["need", ID], [")) {", PU]],
  },
  {
    author: "arjun",
    tokens: [
      ["      ", PU], ["return", KW], [" [", PU], ["seen", ID], [".", PU], ["get", FN], ["(", PU],
      ["need", ID], ["), ", PU], ["i", ID], ["];", PU],
    ],
  },
  { author: "arjun", tokens: [["    }", PU]] },
  {
    author: "arjun",
    tokens: [
      ["    ", PU], ["seen", ID], [".", PU], ["set", FN], ["(", PU], ["nums", ID], ["[", PU],
      ["i", ID], ["], ", PU], ["i", ID], [");", PU],
    ],
  },
  { author: "arjun", tokens: [["  }", PU]] },
  { author: "priya", tokens: [["  ", PU], ["return", KW], [" [];", PU]] },
  { author: "priya", tokens: [["}", PU]] },
];

const PEOPLE: Record<Author, { name: string; avatar: string; cursor: string; flag: string }> = {
  priya: { name: "priya", avatar: DEMO_AVATARS.priya, cursor: "bg-ink-100", flag: "bg-ink-100 text-ink-950" },
  arjun: { name: "arjun", avatar: DEMO_AVATARS.arjun, cursor: "bg-ink-400", flag: "bg-ink-400 text-ink-950" },
};

// ---- Timeline (in ticks) ----
const TICK_MS = 32;
const NEWLINE_PAUSE = 5;
const LINE_LENGTHS = LINES.map((line) => line.tokens.reduce((sum, [text]) => sum + text.length, 0));
const LINE_STARTS: number[] = [];
for (let i = 0; i < LINES.length; i++) {
  LINE_STARTS.push(i === 0 ? 0 : LINE_STARTS[i - 1] + LINE_LENGTHS[i - 1] + NEWLINE_PAUSE);
}
const TYPE_END = LINE_STARTS[LINES.length - 1] + LINE_LENGTHS[LINES.length - 1];
const RUN_PRESS = TYPE_END + 16;
const RUN_DONE = RUN_PRESS + 22;
const FADE_OUT = RUN_DONE + 110;
const LOOP_END = FADE_OUT + 14;
const REST_TICK = RUN_DONE + 70; // final frame shown when motion is reduced

type ChatItem = { at: number; name: string; avatar: string; text: string };

const CHAT: ChatItem[] = [
  { at: 6, name: "priya", avatar: DEMO_AVATARS.priya, text: "i'll set up the map" },
  { at: LINE_STARTS[2] + 6, name: "arjun", avatar: DEMO_AVATARS.arjun, text: "on it, writing the loop" },
  { at: LINE_STARTS[9] + 4, name: "priya", avatar: DEMO_AVATARS.priya, text: "clean. run it 🚀" },
  { at: RUN_DONE + 22, name: "sam", avatar: DEMO_AVATARS.sam, text: "[0, 1]. ship it" },
];

function visibleChars(lineIndex: number, tick: number): number {
  return Math.max(0, Math.min(LINE_LENGTHS[lineIndex], tick - LINE_STARTS[lineIndex]));
}

function cursorFor(author: Author, tick: number): { line: number; column: number } | null {
  let result: { line: number; column: number } | null = null;
  for (let i = 0; i < LINES.length; i++) {
    if (LINES[i].author !== author) continue;
    const visible = visibleChars(i, tick);
    if (visible > 0) result = { line: i, column: visible };
  }
  return result;
}

function typingAuthorAt(tick: number): Author | null {
  if (tick >= TYPE_END) return null;
  for (let i = LINES.length - 1; i >= 0; i--) {
    if (tick >= LINE_STARTS[i]) return LINES[i].author;
  }
  return null;
}

function renderTokens(tokens: Token[], count: number): ReactNode[] {
  const out: ReactNode[] = [];
  let remaining = count;
  for (let k = 0; k < tokens.length && remaining > 0; k++) {
    const [text, cls] = tokens[k];
    const part = text.slice(0, remaining);
    out.push(
      <span key={k} className={cls}>
        {part}
      </span>
    );
    remaining -= part.length;
  }
  return out;
}

function Cursor({ author, active }: { author: Author; active: boolean }) {
  const person = PEOPLE[author];
  return (
    <span className="relative inline-block h-[1.15em] w-0 align-middle">
      <span
        className={`absolute left-0 top-0 h-full w-[2px] rounded-full ${person.cursor} ${active ? "" : "opacity-50"}`}
      />
      <span
        className={`absolute bottom-full left-0 mb-0.5 flex items-center gap-1 whitespace-nowrap rounded-full py-px pl-px pr-1.5 text-[9px] font-semibold leading-3 transition-opacity duration-200 ${person.flag} ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        <AvatarIcon avatarId={person.avatar} className="h-3 w-3 rounded-full" />
        {person.name}
      </span>
    </span>
  );
}

// Memoized on the message count, so the chat only re-renders when a new
// message actually arrives, not on every typing tick.
const ChatFeed = memo(function ChatFeed({ count }: { count: number }) {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 p-3">
      <AnimatePresence initial={false}>
        {CHAT.slice(0, count).map((m) => (
          <motion.div
            key={m.at}
            layout="position"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex items-start gap-2"
          >
            <AvatarIcon avatarId={m.avatar} className="h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-ink-300">{m.name}</p>
              <p className="text-[11px] leading-4 text-ink-400">{m.text}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  // Advance the demo only while it's on screen.
  useEffect(() => {
    if (reduce || !inView) return;
    const timer = setTimeout(() => setTick((n) => (n >= LOOP_END ? 0 : n + 1)), TICK_MS);
    return () => clearTimeout(timer);
  }, [tick, inView, reduce]);

  const t = reduce ? REST_TICK : tick;
  const typingAuthor = typingAuthorAt(t);
  const cursors: Record<Author, { line: number; column: number } | null> = {
    priya: cursorFor("priya", t),
    arjun: cursorFor("arjun", t),
  };
  const focusCursor = (typingAuthor && cursors[typingAuthor]) || cursors.priya;
  const chatCount = CHAT.filter((m) => t >= m.at).length;
  const pressing = t >= RUN_PRESS && t < RUN_PRESS + 5;
  const running = t >= RUN_PRESS && t < RUN_DONE;
  const showOutput = t >= RUN_DONE && t < LOOP_END;
  const fading = t >= FADE_OUT;
  const saving = t > 0 && t < TYPE_END + 18;

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-900/90 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_-30px_rgba(255,255,255,0.18)] backdrop-blur"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
          </div>
          <span className="truncate text-xs font-medium text-ink-300">interview-prep</span>
          <span className="hidden rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-500 sm:inline">
            JavaScript
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="hidden -space-x-1.5 sm:flex">
            {[DEMO_AVATARS.priya, DEMO_AVATARS.arjun, DEMO_AVATARS.sam].map((seed) => (
              <AvatarIcon key={seed} avatarId={seed} className="h-5 w-5 rounded-full ring-2 ring-ink-900" />
            ))}
          </div>
          <span className="hidden items-center gap-1.5 text-[10px] text-ink-500 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-100" />3 online
          </span>
          <motion.span
            animate={{ scale: pressing ? 0.9 : 1 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-[10px] font-semibold text-ink-950"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </motion.span>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className={`py-4 pr-4 font-[family-name:var(--font-mono)] text-[11px] transition-opacity duration-300 sm:text-[13px] ${
              fading ? "opacity-0" : "opacity-100"
            }`}
          >
            {LINES.map((line, i) => {
              const visible = visibleChars(i, t);
              const isActiveLine = !!typingAuthor && focusCursor?.line === i;
              return (
                <div
                  key={i}
                  className={`flex h-5 items-center sm:h-6 ${isActiveLine ? "bg-white/[0.03]" : ""}`}
                >
                  <span className="w-8 shrink-0 select-none pr-3 text-right text-ink-700 sm:w-10">{i + 1}</span>
                  <span className="whitespace-pre">
                    {renderTokens(line.tokens, visible)}
                    {(["priya", "arjun"] as const).map((author) => {
                      const c = cursors[author];
                      return c && c.line === i ? (
                        <Cursor key={author} author={author} active={typingAuthor === author} />
                      ) : null;
                    })}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reserved space the output panel slides into */}
          <div className="h-[76px]" />

          <AnimatePresence>
            {showOutput && (
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="absolute inset-x-0 bottom-0 h-[76px] border-t border-ink-800 bg-ink-950/90 px-4 py-2.5 font-[family-name:var(--font-mono)] text-[11px] sm:text-xs"
              >
                <div className="flex items-center gap-1.5 text-ink-500">
                  <AvatarIcon avatarId={DEMO_AVATARS.priya} className="h-3.5 w-3.5 rounded-full" />
                  <span className="text-ink-300">priya</span> ran JavaScript · 12ms
                </div>
                <div className="mt-1.5 text-ink-500">&gt; twoSum([2, 7, 11, 15], 9)</div>
                <div className="text-ink-100">[0, 1]</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat sidebar */}
        <div
          className={`hidden w-56 shrink-0 flex-col border-l border-ink-800 bg-ink-950/40 transition-opacity duration-300 md:flex ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between border-b border-ink-800 px-3 py-2 text-[10px] uppercase tracking-wide text-ink-500">
            <span>Chat</span>
            <span>3 online</span>
          </div>
          <ChatFeed count={chatCount} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between gap-3 border-t border-ink-800 bg-ink-950/60 px-3 py-1 font-[family-name:var(--font-mono)] text-[10px] text-ink-600 sm:px-4">
        <span>JavaScript</span>
        <span className="flex items-center gap-3">
          <span>
            Ln {focusCursor ? focusCursor.line + 1 : 1}, Col {focusCursor ? focusCursor.column + 1 : 1}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${saving ? "animate-pulse bg-ink-500" : "bg-ink-100"}`} />
            {saving ? "Saving…" : "Saved"}
          </span>
        </span>
      </div>
    </div>
  );
}