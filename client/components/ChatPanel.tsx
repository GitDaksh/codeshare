"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
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
          className="rounded bg-ink-800 px-1 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em] text-ink-100"
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
          className="h-1 w-1 rounded-full bg-ink-500"
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

  // Snapshot of messages that already existed when history first appeared.
  // Taken on the first non-empty render (not at mount), because chat history
  // is fetched asynchronously and usually arrives after this panel mounts.
  // Only messages that arrive after this snapshot get the entrance animation.
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
    // In a column-reverse scroller, scrollTop is 0 at the newest message and
    // becomes increasingly NEGATIVE as you scroll up into older history.
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

  // Rendered newest-first; flex-col-reverse flips the ORDER of these blocks
  // back to normal chronological order visually. It does NOT reverse the
  // contents inside each block, so each block is laid out top-to-bottom as
  // normal: date divider first, then the message.
  const reversedMessages = [...messages].reverse();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex max-h-96 flex-1 flex-col-reverse overflow-y-auto px-3 py-2 md:max-h-none"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-ink-600">No messages yet — say hi.</p>
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
            const reactionGroups = groupReactions(msg.reactions ?? []);

            return (
              <div key={msg._id}>
                {isNewDay && (
                  <div className="my-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-ink-600">
                    <span className="h-px flex-1 bg-ink-800" />
                    {formatDateDivider(msg.createdAt)}
                    <span className="h-px flex-1 bg-ink-800" />
                  </div>
                )}
                <motion.div
                  initial={isNewMessage ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`group relative flex gap-2.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-ink-900/60 ${
                    isGrouped ? "" : "mt-2.5"
                  }`}
                >
                  <div className="pointer-events-none absolute -top-3 right-2 z-10 flex gap-0.5 rounded-md border border-ink-700 bg-ink-900 p-0.5 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onReact(msg._id, emoji)}
                        className="rounded px-1 py-0.5 text-sm transition-transform hover:scale-125 hover:bg-ink-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {isGrouped ? (
                    // Fixed-width gutter. The hover timestamp is absolutely
                    // positioned and non-wrapping, so it can never add height
                    // to the row (the cause of the old spacing bug).
                    <div className="relative w-7 shrink-0">
                      <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[9px] leading-5 text-ink-600 opacity-0 transition-opacity group-hover:opacity-100">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  ) : (
                    <AvatarIcon avatarId={msg.senderAvatarId} className="h-7 w-7 shrink-0 rounded-full" />
                  )}

                  <div className="min-w-0 flex-1">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-ink-100">
                          {msg.senderId === currentUserId ? "You" : msg.senderName}
                        </span>
                        <span className="text-[10px] text-ink-600">{formatTime(msg.createdAt)}</span>
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
                              onClick={() => onReact(msg._id, emoji)}
                              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                                reacted
                                  ? "border-ink-100 bg-ink-100/10 text-ink-100"
                                  : "border-ink-700 text-ink-400 hover:border-ink-500"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{userIds.length}</span>
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
            className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs text-ink-100 shadow-lg"
          >
            <ArrowDown className="h-3 w-3" />
            New messages
          </motion.button>
        )}
      </AnimatePresence>

      <div className="flex h-4 items-center px-3">
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <TypingDots />
            <span className="truncate">
              {typingUsers.map((u) => u.name).join(", ")}
              {typingUsers.length === 1 ? " is" : " are"} typing
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-ink-800 p-3">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message the room…"
          className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="rounded-md bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white active:scale-95"
        >
          Send
        </button>
      </div>
    </div>
  );
}