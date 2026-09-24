"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, MessageSquare } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { ChatMessage, Reaction } from "@/types/chat";
import type { TypingEvent } from "@/types/presence";

type ChatPanelProps = {
  messages: ChatMessage[];
  currentUserId: string | null;
  typingUsers: TypingEvent[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onTypingChange: (isTyping: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TYPING_STOP_DELAY_MS = 2000;
const AT_BOTTOM_THRESHOLD = 60;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function renderMessageText(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={i}
          className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em] text-ink-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function groupReactions(reactions: Reaction[]) {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = map.get(r.emoji) ?? [];
    arr.push(r.userId);
    map.set(r.emoji, arr);
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({ emoji, userIds }));
}

function TypingDots() {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-ink-400"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function ChatPanel({
  messages,
  currentUserId,
  typingUsers,
  draft,
  onDraftChange,
  onSend,
  onTypingChange,
  onReact,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Touch screens can't hover, so the reaction bar and hover timestamps would
  // never appear there. On touch, tapping a message toggles them instead.
  const isTouch = useMediaQuery("(hover: none)");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const historyIdsRef = useRef<Set<string> | null>(null);
  if (historyIdsRef.current === null && messages.length > 0) {
    historyIdsRef.current = new Set(messages.map((m) => m._id));
  }

  useEffect(() => {
    if (isAtBottom) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(Math.abs(el.scrollTop) < AT_BOTTOM_THRESHOLD);
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setIsAtBottom(true);
  }

  function handleDraftChange(value: string) {
    onDraftChange(value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingChange(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingChange(false);
    }, TYPING_STOP_DELAY_MS);
  }

  function handleSend() {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange(false);
    }
    onSend();
  }

  function handleReactClick(e: ReactMouseEvent, messageId: string, emoji: string) {
    // Stop the tap from also toggling the message row underneath.
    e.stopPropagation();
    onReact(messageId, emoji);
    setActiveMessageId(null);
  }

  const reversedMessages = [...messages].reverse();
  const canSend = draft.trim().length > 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 py-2"
      >
        {messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
              <MessageSquare className="h-4 w-4 text-ink-300" />
            </div>
            <p className="text-sm font-medium text-ink-100">No messages yet</p>
            <p className="max-w-[14rem] text-xs text-ink-400">Say hi. Everyone in the room will see it instantly.</p>
          </div>
        ) : (
          reversedMessages.map((msg, revIndex) => {
            const older = reversedMessages[revIndex + 1];
            const isNewDay =
              !!older &&
              new Date(older.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
            const isGrouped =
              !isNewDay &&
              !!older &&
              older.senderId === msg.senderId &&
              new Date(msg.createdAt).getTime() - new Date(older.createdAt).getTime() < GROUP_WINDOW_MS;
            const isNewMessage = historyIdsRef.current !== null && !historyIdsRef.current.has(msg._id);
            const isActive = isTouch && activeMessageId === msg._id;
            const reactionGroups = groupReactions(msg.reactions ?? []);

            return (
              <div key={msg._id}>
                {isNewDay && (
                  <div className="my-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    <span className="h-px flex-1 bg-ink-800" />
                    {formatDateDivider(msg.createdAt)}
                    <span className="h-px flex-1 bg-ink-800" />
                  </div>
                )}
                <motion.div
                  initial={isNewMessage ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => {
                    if (isTouch) setActiveMessageId((prev) => (prev === msg._id ? null : msg._id));
                  }}
                  className={`group relative flex gap-2.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-ink-800/50 ${
                    isActive ? "bg-ink-800/50" : ""
                  } ${isGrouped ? "" : "mt-2.5"}`}
                >
                  <div
                    className={`absolute -top-3 right-2 z-10 flex gap-0.5 rounded-lg border border-ink-700 bg-ink-800 p-0.5 shadow-lg shadow-black/40 transition-opacity ${
                      isActive
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                    }`}
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => handleReactClick(e, msg._id, emoji)}
                        className={`rounded-md transition-transform hover:scale-125 hover:bg-ink-700 ${
                          isTouch ? "px-1.5 py-1 text-base" : "px-1 py-0.5 text-sm"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {isGrouped ? (
                    <div className="relative w-7 shrink-0">
                      <span
                        className={`absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px] leading-5 text-ink-500 transition-opacity ${
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  ) : (
                    <AvatarIcon avatarId={msg.senderAvatarId} className="h-7 w-7 shrink-0 rounded-full" />
                  )}

                  <div className="min-w-0 flex-1">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold text-ink-100">
                          {msg.senderId === currentUserId ? "You" : msg.senderName}
                        </span>
                        <span className="shrink-0 text-[10px] text-ink-500">{formatTime(msg.createdAt)}</span>
                      </div>
                    )}
                    <p className="break-words text-sm leading-5 text-ink-300">{renderMessageText(msg.text)}</p>
                    {reactionGroups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {reactionGroups.map(({ emoji, userIds }) => {
                          const reacted = currentUserId ? userIds.includes(currentUserId) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => handleReactClick(e, msg._id, emoji)}
                              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                                reacted
                                  ? "border-ink-300 bg-ink-100/10 text-ink-100"
                                  : "border-ink-700 bg-ink-800/60 text-ink-300 hover:border-ink-500"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="tabular-nums">{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={scrollToBottom}
            className="absolute bottom-32 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-100 shadow-lg shadow-black/50"
          >
            <ArrowDown className="h-3 w-3" />
            New messages
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex h-5 items-center px-4">
        {typingUsers.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-400">
            <TypingDots />
            <span className="truncate">
              {typingUsers.map((u) => u.name).join(", ")}
              {typingUsers.length === 1 ? " is" : " are"} typing
            </span>
          </div>
        )}
      </div>

      {/* Message box: one rounded field with an inline send button */}
      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-950/70 py-1 pl-3.5 pr-1 transition-colors focus-within:border-ink-500">
          <input
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message the room…"
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-950 transition-all hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 hidden px-1 text-[10px] text-ink-500 md:block">
          Enter to send · wrap code in <span className="font-[family-name:var(--font-mono)] text-ink-400">`backticks`</span>
        </p>
      </div>
    </div>
  );
}