"use client";

import { useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, FlaskConical, Flag, Gauge, Lightbulb, MessageSquarePlus, Send } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import type { InterviewKit } from "@/lib/interviewKits";
import {
  formatClock,
  latestComplexity,
  latestTests,
  sameComplexity,
  type InterviewNote,
  type InterviewState,
} from "@/lib/interview";

type InterviewerPanelProps = {
  interview: InterviewState;
  notes: InterviewNote[];
  kit: InterviewKit | null;
  candidateOnline: boolean;
  onGiveHint: (text?: string) => void;
  onAddNote: (text: string, tag?: string) => void;
};

// One-click observations, timestamped like any note.
const QUICK_TAGS: { text: string; tag: string }[] = [
  { text: "Asked clarifying questions", tag: "+" },
  { text: "Clear plan before coding", tag: "+" },
  { text: "Clean code", tag: "+" },
  { text: "Tested edge cases", tag: "+" },
  { text: "Strong communication", tag: "+" },
  { text: "Needed a nudge", tag: "−" },
  { text: "Stuck for a while", tag: "−" },
  { text: "Missed an edge case", tag: "−" },
  { text: "Bug in the solution", tag: "−" },
];

const SECTION = "border-b border-ink-800 px-4 py-4";
const HEADING = "mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500";

// The interviewer's side panel: how the candidate is doing, the hint ladder,
// the answer key and follow-ups, and private notes. Nobody else sees it.
export function InterviewerPanel({ interview, notes, kit, candidateOnline, onGiveHint, onAddNote }: InterviewerPanelProps) {
  const [draft, setDraft] = useState("");
  const [customHint, setCustomHint] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [followUpsOpen, setFollowUpsOpen] = useState(true);

  const ended = interview.status === "ended";
  const tests = latestTests(interview.events);
  const complexity = latestComplexity(interview.events);
  const done = interview.events.find((event) => event.type === "done");
  const hintTimes = interview.events.filter((event) => event.type === "hint").map((event) => event.at);
  const askedFollowUps = new Set(notes.filter((note) => note.tag === "follow-up").map((note) => note.text.replace(/^Asked: /, "")));

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    onAddNote(text);
    setDraft("");
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* The candidate, live */}
      <div className={SECTION}>
        <div className="flex items-center gap-2.5">
          <span className="relative shrink-0">
            <AvatarIcon avatarId={interview.candidate.avatarId} className="h-9 w-9 rounded-full" />
            {candidateOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-ink-100" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-100">{interview.candidate.name}</p>
            <p className="text-[11px] text-ink-500">
              {candidateOnline ? "In the room" : "Not in the room right now"}
              {done ? ` · said they're done at ${formatClock(done.at)}` : ""}
            </p>
          </div>
          {done && <Flag className="h-4 w-4 shrink-0 text-ink-100" />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500">
              <FlaskConical className="h-3 w-3" /> Tests
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">
              {tests ? `${tests.passed}/${tests.total}` : "Not run yet"}
            </p>
            {tests && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-ink-100 transition-all"
                  style={{ width: `${tests.total ? (tests.passed / tests.total) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500">
              <Gauge className="h-3 w-3" /> Big-O
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm text-ink-100">
              {complexity ? complexity.time : "Not measured"}
            </p>
            {kit && complexity && (
              <p className={`mt-0.5 text-[10px] ${sameComplexity(complexity.time, kit.time) ? "text-ink-200" : "text-ink-500"}`}>
                {sameComplexity(complexity.time, kit.time) ? "✓ matches the target" : `Target ${kit.time}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hints */}
      <div className={SECTION}>
        <p className={HEADING}>
          <Lightbulb className="h-3.5 w-3.5" />
          Hints
        </p>
        {kit ? (
          <ol className="space-y-2">
            {kit.hints.map((hint, index) => {
              const given = index < interview.hintsGiven;
              const next = index === interview.hintsGiven;
              return (
                <li
                  key={index}
                  className={`rounded-xl border px-3 py-2.5 ${
                    given ? "border-ink-700 bg-ink-800/60" : next ? "border-ink-600" : "border-ink-800 opacity-60"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                      {["Nudge", "Direction", "Near-solution"][index] ?? `Hint ${index + 1}`}
                    </span>
                    {given ? (
                      <span className="flex items-center gap-1 text-[10px] text-ink-400">
                        <Check className="h-3 w-3" />
                        Given at {formatClock(hintTimes[index] ?? 0)}
                      </span>
                    ) : (
                      next &&
                      !ended && (
                        <button
                          type="button"
                          onClick={() => onGiveHint()}
                          className="flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-white"
                        >
                          <Send className="h-3 w-3" />
                          Give hint
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-300">{hint}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="space-y-2">
            {interview.customHints.map((hint, index) => (
              <p key={index} className="rounded-xl border border-ink-700 bg-ink-800/60 px-3 py-2 text-xs text-ink-300">
                <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {index + 1} · {formatClock(hintTimes[index] ?? 0)}
                </span>
                {hint}
              </p>
            ))}
            {!ended && (
              <div className="flex gap-1.5">
                <input
                  value={customHint}
                  onChange={(e) => setCustomHint(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customHint.trim()) {
                      onGiveHint(customHint.trim());
                      setCustomHint("");
                    }
                  }}
                  placeholder="Write a hint for your question"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-ink-800 bg-ink-950/60 px-2.5 text-xs text-ink-100 placeholder:text-ink-500 focus:border-ink-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!customHint.trim()}
                  onClick={() => {
                    onGiveHint(customHint.trim());
                    setCustomHint("");
                  }}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-ink-100 px-2.5 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-white disabled:opacity-40"
                >
                  <Send className="h-3 w-3" />
                  Give
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Answer key and follow-ups */}
      {kit && (
        <div className={SECTION}>
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className={`${HEADING} mb-0`}>
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Answer key
            </span>
            <span className="text-[11px] text-ink-500">{showKey ? "Hide" : "Show"}</span>
          </button>
          {showKey && (
            <div className="mt-2.5 rounded-xl border border-ink-800 bg-ink-950/60 p-3">
              <p className="text-xs leading-relaxed text-ink-200">{kit.approach}</p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded border border-ink-700 px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] text-ink-300">
                  Time {kit.time}
                </span>
                <span className="rounded border border-ink-700 px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] text-ink-300">
                  Space {kit.space}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFollowUpsOpen((s) => !s)}
            className="mt-4 flex w-full items-center justify-between text-left"
          >
            <span className={`${HEADING} mb-0`}>Follow-ups</span>
            <ChevronDown className={`h-3.5 w-3.5 text-ink-500 transition-transform ${followUpsOpen ? "rotate-180" : ""}`} />
          </button>
          {followUpsOpen && (
            <ul className="mt-2 space-y-1.5">
              {kit.followUps.map((question) => {
                const asked = askedFollowUps.has(question);
                return (
                  <li key={question} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => !asked && !ended && onAddNote(`Asked: ${question}`, "follow-up")}
                      disabled={asked || ended}
                      title={asked ? "Asked" : "Mark as asked (adds a note)"}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        asked ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-600 hover:border-ink-400"
                      }`}
                    >
                      {asked && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`text-xs leading-relaxed ${asked ? "text-ink-500 line-through" : "text-ink-300"}`}>
                      {question}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Private notes */}
      <div className="px-4 py-4">
        <p className={HEADING}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Notes <span className="normal-case tracking-normal text-ink-600">· only you see these</span>
        </p>
        {!ended && (
          <>
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_TAGS.map((quick) => (
                <button
                  key={quick.text}
                  type="button"
                  onClick={() => onAddNote(quick.text, quick.tag)}
                  className="rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
                >
                  <span className="mr-0.5 text-ink-500">{quick.tag}</span>
                  {quick.text}
                </button>
              ))}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addNote();
                }
              }}
              rows={2}
              placeholder="Write a note (Enter to save). It's stamped with the interview time."
              className="w-full resize-none rounded-lg border border-ink-800 bg-ink-950/60 px-2.5 py-2 text-xs leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-ink-600 focus:outline-none"
            />
          </>
        )}
        {notes.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-600">No notes yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {notes.map((note, index) => (
              <li key={`${note.at}-${index}`} className="flex gap-2 text-xs">
                <span className="w-10 shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-ink-500">
                  {formatClock(note.at)}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed text-ink-200">
                  {note.tag && note.tag !== "follow-up" && <span className="mr-1 text-ink-500">{note.tag}</span>}
                  {note.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}