import type { IInterview } from "../models/Interview";

// How long the 3-2-1 countdown lasts before the clock starts.
export const COUNTDOWN_MS = 3500;
export const MAX_EVENTS = 400;
export const MAX_NOTES = 300;
export const MAX_SNAPSHOTS = 30;
export const MAX_EXTRA_MS = 60 * 60 * 1000;
// An interview nobody ended is closed this long after its time ran out.
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function isActive(interview: Pick<IInterview, "status">): boolean {
  return interview.status === "running" || interview.status === "paused";
}

// Interview time: milliseconds since the start, not counting pauses (0 during
// the countdown).
export function elapsedMs(interview: IInterview, now = Date.now()): number {
  const end = interview.status === "ended" && interview.endedAt ? interview.endedAt.getTime() : now;
  const pausedNow = interview.status === "paused" && interview.pausedAt ? end - interview.pausedAt.getTime() : 0;
  return Math.max(0, end - interview.startedAt.getTime() - interview.pausedMs - pausedNow);
}

export function isStale(interview: IInterview, now = Date.now()): boolean {
  return isActive(interview) && elapsedMs(interview, now) > interview.durationMs + interview.extraMs + STALE_AFTER_MS;
}

// What everyone in the room may see, live. Private notes never go here.
export function publicInterview(interview: IInterview) {
  return {
    id: interview._id.toString(),
    roomId: interview.roomId.toString(),
    mode: interview.mode,
    interviewer: { userId: interview.interviewerId, name: interview.interviewerName, avatarId: interview.interviewerAvatar },
    candidate: { userId: interview.candidateId, name: interview.candidateName, avatarId: interview.candidateAvatar },
    problemSlug: interview.problemSlug,
    custom: interview.customTitle ? { title: interview.customTitle, prompt: interview.customPrompt ?? "" } : null,
    language: interview.language,
    durationMs: interview.durationMs,
    extraMs: interview.extraMs,
    status: interview.status,
    startedAt: interview.startedAt.toISOString(),
    pausedAt: interview.pausedAt ? interview.pausedAt.toISOString() : null,
    pausedMs: interview.pausedMs,
    endedAt: interview.endedAt ? interview.endedAt.toISOString() : null,
    phase: interview.phase,
    hintsGiven: interview.hintsGiven,
    customHints: interview.customHints,
    events: interview.events,
    // Lets each browser correct for its own clock being off.
    serverNow: new Date().toISOString(),
  };
}

// The report: everything, minus the private notes for the candidate.
export function interviewReport(interview: IInterview, forInterviewer: boolean) {
  return {
    ...publicInterview(interview),
    snapshots: interview.snapshots,
    finalCode: interview.finalCode,
    ratings: interview.ratings,
    verdict: interview.verdict,
    feedback: interview.feedback,
    shared: interview.shared,
    notes: forInterviewer ? interview.notes : [],
    viewer: forInterviewer ? "interviewer" : "candidate",
  };
}