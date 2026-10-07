"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  FlaskConical,
  Gauge,
  Lightbulb,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import type { InterviewKit } from "@/lib/interviewKits";
import {
  describeMonitor,
  formatClock,
  formatDuration,
  latestComplexity,
  latestTests,
  questionTitle,
  sameComplexity,
  summarizeIntegrity,
  type InterviewNote,
  type InterviewState,
} from "@/lib/interview";

type InterviewerPanelProps = {
  interview: InterviewState;
  notes: InterviewNote[];
  // The current question's kit, for Practice problems.
  kit: InterviewKit | null;
  candidateOnline: boolean;
  onGiveHint: (text?: string) => void;
  onGoto: (index: number) => void;
  onAddNote: (text: string, tag?: string) => void;
};

type Tab = "now" | "questions" | "integrity" | "notes";

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

const HEADING = "mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500";
const CARD = "rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2";
// The sign on a quick observation: green for strengths, red for concerns.
const SIGN = (tag: string) => (tag === "+" ? "text-success" : tag === "−" ? "text-danger" : "text-ink-500");

// The interviewers' side panel: the question in progress, every question,
// what monitoring saw, and the panel's shared notes. The candidate never
// sees any of it.
export function InterviewerPanel({ interview, notes, kit, candidateOnline, onGiveHint, onGoto, onAddNote }: InterviewerPanelProps) {
  const [tab, setTab] = useState<Tab>("now");
  const [draft, setDraft] = useState("");
  const [customHint, setCustomHint] = useState("");
  const [showKey, setShowKey] = useState(false);

  const ended = interview.status === "ended";
  const scheduled = interview.status === "scheduled";
  const current = interview.current;
  const question = interview.questions[current];
  const tests = latestTests(interview.events, current);
  const complexity = latestComplexity(interview.events, current);
  const done = interview.events.find((event) => event.type === "done" && event.question === current);
  const hintTimes = interview.events.filter((e) => e.type === "hint" && e.question === current).map((e) => e.at);
  const integrity = summarizeIntegrity(interview.events);
  const monitoring = interview.settings.monitoring && interview.mode === "live";
  const hints = question?.problemSlug ? (kit?.hints ?? []) : (question?.hints ?? []);
  const askedFollowUps = new Set(
    notes.filter((note) => note.tag === "follow-up").map((note) => note.text.replace(/^Asked: /, ""))
  );
  const target = question?.problemSlug ? kit?.time : null;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "now", label: "Now" },
    { id: "questions", label: "Questions" },
    ...(monitoring ? [{ id: "integrity" as const, label: "Integrity", badge: integrity.flags.length }] : []),
    { id: "notes", label: "Notes", badge: notes.length },
  ];

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    onAddNote(text);
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-ink-800 px-2 py-1.5">
        <div className="flex gap-0.5 rounded-lg border border-ink-800 bg-ink-950 p-0.5">
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className="relative flex-1 rounded-md px-2 py-1 text-[11px] font-medium"
            >
              {tab === option.id && (
                <motion.span
                  layoutId="interviewer-panel-tab"
                  className="absolute inset-0 rounded-md bg-ink-900 shadow-xs ring-1 ring-ink-800"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                />
              )}
              <span className={`relative flex items-center justify-center gap-1 ${tab === option.id ? "text-ink-100" : "text-ink-500 hover:text-ink-100"}`}>
                {option.label}
                {!!option.badge && (
                  <span
                    className={`rounded px-1 text-[9px] tabular-nums ${
                      option.id === "integrity" ? "bg-warning-soft text-warning" : "bg-ink-800 text-ink-400"
                    }`}
                  >
                    {option.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ---------- The question in progress ---------- */}
        {tab === "now" && (
          <div>
            <div className="border-b border-ink-800 px-4 py-4">
              <div className="flex items-center gap-2.5">
                {interview.candidate ? (
                  <span className="relative shrink-0">
                    <AvatarIcon avatarId={interview.candidate.avatarId} className="h-9 w-9 rounded-full" />
                    {candidateOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-success-strong" />
                    )}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-100">{interview.candidate?.name ?? "No candidate yet"}</p>
                  <p className="text-[11px] text-ink-500">
                    {candidateOnline ? "In the room" : "Not in the room right now"}
                    {done ? ` · said they're done at ${formatClock(done.at)}` : ""}
                  </p>
                </div>
                {done && <Flag className="h-4 w-4 shrink-0 text-success" />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={CARD}>
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500">
                    <FlaskConical className="h-3 w-3" /> Tests
                  </p>
                  <p
                    className={`mt-0.5 font-[family-name:var(--font-mono)] text-sm tabular-nums ${
                      tests && tests.total > 0 && tests.passed === tests.total ? "text-success" : "text-ink-100"
                    }`}
                  >
                    {tests ? `${tests.passed}/${tests.total}` : "Not run yet"}
                  </p>
                  {tests && (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          tests.total > 0 && tests.passed === tests.total ? "bg-success-strong" : "bg-ink-300"
                        }`}
                        style={{ width: `${tests.total ? (tests.passed / tests.total) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className={CARD}>
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500">
                    <Gauge className="h-3 w-3" /> Big-O
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm text-ink-100">
                    {complexity ? complexity.time : "Not measured"}
                  </p>
                  {target && complexity && (
                    <p className={`mt-0.5 text-[10px] ${sameComplexity(complexity.time, target) ? "text-success" : "text-ink-500"}`}>
                      {sameComplexity(complexity.time, target) ? "✓ matches the target" : `Target ${target}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {question && (
              <div className="border-b border-ink-800 px-4 py-4">
                <p className={HEADING}>
                  <Lightbulb className="h-3.5 w-3.5" />
                  Hints · {questionTitle(question, current)}
                </p>
                {!interview.settings.hints ? (
                  <p className="text-xs text-ink-500">Hints are off for this interview.</p>
                ) : (
                  <ol className="space-y-2">
                    {hints.map((hint, index) => {
                      const given = index < question.hintsGiven;
                      const next = index === question.hintsGiven;
                      return (
                        <li
                          key={index}
                          className={`rounded-lg border px-3 py-2.5 ${
                            given ? "border-ink-700 bg-ink-800/60" : next ? "border-ink-600" : "border-ink-800 opacity-60"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                              {question.problemSlug ? (["Nudge", "Direction", "Near-solution"][index] ?? `Hint ${index + 1}`) : `Hint ${index + 1}`}
                            </span>
                            {given ? (
                              <span className="flex items-center gap-1 text-[10px] text-ink-400">
                                <Check className="h-3 w-3" />
                                Given at {formatClock(hintTimes[index] ?? 0)}
                              </span>
                            ) : (
                              next &&
                              !ended &&
                              !scheduled && (
                                <button
                                  type="button"
                                  onClick={() => onGiveHint()}
                                  className="flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-ink-200"
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
                    {!question.problemSlug && !ended && !scheduled && question.hintsGiven >= hints.length && (
                      <li className="flex gap-1.5">
                        <input
                          value={customHint}
                          onChange={(e) => setCustomHint(e.target.value.slice(0, 500))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && customHint.trim()) {
                              onGiveHint(customHint.trim());
                              setCustomHint("");
                            }
                          }}
                          placeholder="Write a hint and give it"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 shadow-xs placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={!customHint.trim()}
                          onClick={() => {
                            onGiveHint(customHint.trim());
                            setCustomHint("");
                          }}
                          className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-ink-100 px-2.5 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-ink-200 disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          Give
                        </button>
                      </li>
                    )}
                  </ol>
                )}
              </div>
            )}

            {question && (kit || question.answer) && (
              <div className="px-4 py-4">
                <button type="button" onClick={() => setShowKey((s) => !s)} className="flex w-full items-center justify-between">
                  <span className={`${HEADING} mb-0`}>
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    Answer key
                  </span>
                  <span className="text-[11px] text-ink-500">{showKey ? "Hide" : "Show"}</span>
                </button>
                {showKey && (
                  <div className="mt-2.5 rounded-lg border border-ink-800 bg-ink-950/60 p-3">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-200">{kit ? kit.approach : question.answer}</p>
                    {kit && (
                      <div className="mt-2 flex gap-1.5">
                        <span className="rounded border border-ink-700 px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] text-ink-300">
                          Time {kit.time}
                        </span>
                        <span className="rounded border border-ink-700 px-1.5 py-px font-[family-name:var(--font-mono)] text-[10px] text-ink-300">
                          Space {kit.space}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {kit && (
                  <ul className="mt-4 space-y-1.5">
                    <li className={`${HEADING} mb-1`}>Follow-ups</li>
                    {kit.followUps.map((followUp) => {
                      const asked = askedFollowUps.has(followUp);
                      return (
                        <li key={followUp} className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => !asked && !ended && onAddNote(`Asked: ${followUp}`, "follow-up")}
                            disabled={asked || ended}
                            title={asked ? "Asked" : "Mark as asked (adds a note)"}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              asked ? "border-success-strong bg-success-strong text-white" : "border-ink-600 hover:border-ink-400"
                            }`}
                          >
                            {asked && <Check className="h-3 w-3" />}
                          </button>
                          <span className={`text-xs leading-relaxed ${asked ? "text-ink-500 line-through" : "text-ink-300"}`}>
                            {followUp}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------- Every question ---------- */}
        {tab === "questions" && (
          <ol className="space-y-2 px-3 py-3">
            {interview.questions.map((item, index) => {
              const active = index === current && !scheduled;
              const run = latestTests(interview.events, index);
              return (
                <li
                  key={index}
                  className={`rounded-lg border px-3 py-2.5 ${active ? "border-ink-500 bg-ink-800/60" : "border-ink-800"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${
                        active ? "bg-ink-100 text-ink-950" : item.status === "done" ? "border border-ink-600 text-ink-300" : "border border-ink-800 text-ink-500"
                      }`}
                    >
                      {item.status === "done" && !active ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{questionTitle(item, index)}</span>
                    {!active && !ended && !scheduled && (
                      <button
                        type="button"
                        onClick={() => onGoto(index)}
                        className="flex shrink-0 items-center gap-0.5 rounded-md border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] text-ink-300 shadow-xs transition-colors hover:border-ink-600 hover:text-ink-100"
                      >
                        Go
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-7 text-[11px] text-ink-500">
                    <span>
                      {formatDuration(item.timeSpentMs)} / {item.minutes}m
                    </span>
                    <span>{item.hintsGiven} hints</span>
                    <span>{run ? `Tests ${run.passed}/${run.total}` : "No test runs"}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {/* ---------- What monitoring saw ---------- */}
        {tab === "integrity" && (
          <div className="px-4 py-4">
            <div
              className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
                integrity.flags.length ? "border-warning-line bg-warning-soft" : "border-success-line bg-success-soft"
              }`}
            >
              {integrity.flags.length ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              )}
              <p className="text-xs text-ink-300">
                {integrity.flags.length
                  ? `${integrity.flags.length} thing${integrity.flags.length === 1 ? "" : "s"} worth a look.`
                  : "Nothing unusual so far."}
                {integrity.consented ? " The candidate acknowledged monitoring." : " The candidate hasn't acknowledged monitoring yet."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Tab switches", String(integrity.tabSwitches)],
                ["Time away", formatDuration(integrity.awayMs)],
                ["Pastes", integrity.pastes ? `${integrity.pastes} · ${integrity.pastedChars.toLocaleString()} chars` : "0"],
                ["Largest paste", integrity.largestPaste ? `${integrity.largestPaste.toLocaleString()} chars` : "–"],
                ["Large insertions", String(integrity.inserts)],
                ["Other tabs / drops", `${integrity.extraTabs} / ${integrity.drops}`],
              ].map(([label, value]) => (
                <div key={label} className={CARD}>
                  <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
                  <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">{value}</p>
                </div>
              ))}
            </div>
            <p className={`${HEADING} mt-5`}>Activity</p>
            {interview.events.filter((event) => event.type === "monitor").length === 0 ? (
              <p className="text-[11px] text-ink-500">Nothing yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {[...interview.events]
                  .filter((event) => event.type === "monitor")
                  .reverse()
                  .map((event, index) => (
                    <li key={`${event.at}-${index}`} className="flex gap-2 text-xs">
                      <span className="w-10 shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-ink-500">
                        {formatClock(event.at)}
                      </span>
                      <span className="min-w-0 flex-1 text-ink-200">{describeMonitor(event)}</span>
                      <span className="shrink-0 text-[10px] text-ink-600">Q{(event.question ?? 0) + 1}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {/* ---------- The panel's notes ---------- */}
        {tab === "notes" && (
          <div className="px-4 py-4">
            <p className={HEADING}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Notes <span className="normal-case tracking-normal text-ink-600">· shared with the interviewers only</span>
            </p>
            {!ended && (
              <>
                <div className="mb-2 flex flex-wrap gap-1">
                  {QUICK_TAGS.map((quick) => (
                    <button
                      key={quick.text}
                      type="button"
                      onClick={() => onAddNote(quick.text, quick.tag)}
                      className="rounded-md border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
                    >
                      <span className={`mr-0.5 font-semibold ${SIGN(quick.tag)}`}>{quick.tag}</span>
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
                  placeholder="Write a note (Enter to save). It's stamped with the time and question."
                  className="w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2 text-xs leading-relaxed text-ink-100 shadow-xs placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                />
              </>
            )}
            {notes.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink-500">No notes yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {notes.map((note, index) => (
                  <li key={`${note.at}-${index}`} className="text-xs">
                    <p className="flex items-center gap-1.5 text-[10px] text-ink-500">
                      <span className="font-[family-name:var(--font-mono)] tabular-nums">{formatClock(note.at)}</span>
                      <span>· Q{note.question + 1}</span>
                      <span>· {note.authorName}</span>
                    </p>
                    <p className="mt-0.5 leading-relaxed text-ink-200">
                      {note.tag && note.tag !== "follow-up" && <span className={`mr-1 font-semibold ${SIGN(note.tag)}`}>{note.tag}</span>}
                      {note.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}