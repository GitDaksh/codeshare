import { Interview, type IInterview, type IInterviewQuestion } from "../models/Interview";
import { newInviteCode } from "./inviteCode";

// How long the 3-2-1 countdown lasts before the clock starts.
export const COUNTDOWN_MS = 3500;
export const MAX_EVENTS = 1000;
export const MAX_MONITOR_EVENTS = 400;
export const MAX_NOTES = 400;
export const MAX_SNAPSHOTS = 60;
export const MAX_EXTRA_MS = 60 * 60 * 1000;
export const MAX_QUESTIONS = 8;
export const MAX_INTERVIEWERS = 4;
// An interview nobody ended is closed this long after its time ran out.
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = { hints: true, runTests: true, lens: false, meter: true, monitoring: true };

export function isActive(interview: Pick<IInterview, "status">): boolean {
  return interview.status === "running" || interview.status === "paused";
}

export function isInterviewer(interview: IInterview, userId: unknown): boolean {
  return typeof userId === "string" && interview.interviewers.some((person) => person.userId === userId);
}

export function isCandidate(interview: IInterview, userId: unknown): boolean {
  return typeof userId === "string" && interview.candidate?.userId === userId;
}

// Interview time: milliseconds since the start, not counting pauses (0
// before it starts and during the countdown).
export function elapsedMs(interview: IInterview, now = Date.now()): number {
  if (!interview.startedAt) return 0;
  const end = interview.status === "ended" && interview.endedAt ? interview.endedAt.getTime() : now;
  const pausedNow = interview.status === "paused" && interview.pausedAt ? end - interview.pausedAt.getTime() : 0;
  return Math.max(0, end - interview.startedAt.getTime() - interview.pausedMs - pausedNow);
}

export function isStale(interview: IInterview, now = Date.now()): boolean {
  return isActive(interview) && elapsedMs(interview, now) > interview.durationMs + interview.extraMs + STALE_AFTER_MS;
}

// A question as someone may see it. Interviewers see every question, every
// hint and the answer key; everyone else sees a question once the interview
// reaches it, and only the hints given so far.
function questionView(question: IInterviewQuestion, index: number, staff: boolean) {
  const base = {
    index,
    minutes: question.minutes,
    status: question.status,
    hintsGiven: question.hintsGiven,
    timeSpentMs: question.timeSpentMs,
  };
  if (!staff && question.status === "pending") return { ...base, hidden: true as const };
  return {
    ...base,
    hidden: false as const,
    problemSlug: question.problemSlug,
    title: question.title,
    prompt: question.prompt,
    hints: staff ? question.hints : question.hints.slice(0, question.hintsGiven),
    ...(staff ? { answer: question.answer } : {}),
  };
}

// The interview as someone in the room may see it, live. Interviewers get
// everything but the notes (sent separately); the candidate and observers
// never see the integrity events, the invite codes, or questions to come.
export function publicInterview(interview: IInterview, staff: boolean) {
  return {
    id: interview._id.toString(),
    roomId: interview.roomId.toString(),
    mode: interview.mode,
    title: interview.title,
    position: interview.position,
    level: interview.level,
    language: interview.language,
    organizerId: interview.organizerId,
    interviewers: interview.interviewers,
    candidate: interview.candidate,
    questions: interview.questions.map((question, index) => questionView(question, index, staff)),
    current: interview.current,
    currentSince: interview.currentSince,
    durationMs: interview.durationMs,
    extraMs: interview.extraMs,
    status: interview.status,
    scheduledFor: interview.scheduledFor ? interview.scheduledFor.toISOString() : null,
    startedAt: interview.startedAt ? interview.startedAt.toISOString() : null,
    pausedAt: interview.pausedAt ? interview.pausedAt.toISOString() : null,
    pausedMs: interview.pausedMs,
    endedAt: interview.endedAt ? interview.endedAt.toISOString() : null,
    phase: interview.phase,
    settings: interview.settings,
    events: staff ? interview.events : interview.events.filter((event) => event.type !== "monitor"),
    ...(staff ? { codes: interview.codes, invitedCandidateId: interview.invitedCandidateId } : {}),
    // Lets each browser correct for its own clock being off.
    serverNow: new Date().toISOString(),
  };
}

// The report: each question's code, the snapshots and the scorecards, plus
// (for interviewers) the notes and the integrity events.
export function interviewReport(interview: IInterview, staff: boolean) {
  return {
    ...publicInterview(interview, staff),
    questions: interview.questions.map((question, index) => ({
      ...questionView(question, index, staff),
      ...(staff || question.status !== "pending" ? { code: question.code } : {}),
    })),
    snapshots: staff ? interview.snapshots : interview.snapshots.filter((snapshot) => interview.questions[snapshot.question]?.status !== "pending"),
    scorecards: interview.scorecards,
    notes: staff ? interview.notes : [],
    shared: interview.shared,
    viewer: staff ? "interviewer" : "candidate",
  };
}

// A card on the Interviews page.
export function interviewListItem(interview: IInterview, userId: string) {
  const staff = isInterviewer(interview, userId);
  const verdicts = interview.scorecards.map((card) => card.verdict);
  return {
    id: interview._id.toString(),
    roomId: interview.roomId.toString(),
    mode: interview.mode,
    title: interview.title,
    position: interview.position,
    level: interview.level,
    language: interview.language,
    status: interview.status,
    role: staff ? "interviewer" : "candidate",
    organizer: interview.organizerId === userId,
    scheduledFor: interview.scheduledFor,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    createdAt: interview.createdAt,
    durationMs: interview.durationMs,
    questionCount: interview.questions.length,
    interviewers: interview.interviewers,
    candidate: interview.candidate,
    // Verdicts: interviewers always; the candidate once it's shared.
    verdicts: staff || interview.shared ? verdicts : [],
    scorecardCount: interview.scorecards.length,
  };
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Interviews made before multi-question interviews (one question, one
// interviewer) take the new shape. Runs at startup; does nothing once done.
export async function prepareInterviews(): Promise<void> {
  const legacy = await Interview.collection.find({ questions: { $exists: false } }).toArray();
  for (const doc of legacy) {
    const interviewer = {
      userId: doc.interviewerId,
      name: doc.interviewerName ?? "Interviewer",
      avatarId: doc.interviewerAvatar ?? "codeshare",
    };
    const candidate = doc.candidateId
      ? { userId: doc.candidateId, name: doc.candidateName ?? "Candidate", avatarId: doc.candidateAvatar ?? "codeshare" }
      : null;
    const question = {
      problemSlug: doc.problemSlug ?? null,
      title: doc.customTitle ?? null,
      prompt: doc.customPrompt ?? null,
      hints: doc.customHints ?? [],
      answer: null,
      minutes: Math.max(5, Math.round((doc.durationMs ?? 0) / 60000)),
      status: doc.status === "ended" ? "done" : "active",
      hintsGiven: doc.hintsGiven ?? 0,
      timeSpentMs: 0,
      starter: "",
      code: doc.finalCode ?? "",
    };
    await Interview.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          title: doc.customTitle ?? (doc.problemSlug ? titleFromSlug(doc.problemSlug) : "Interview"),
          position: null,
          level: null,
          organizerId: doc.interviewerId,
          interviewers: [interviewer],
          candidate,
          invitedCandidateId: null,
          questions: [question],
          current: 0,
          currentSince: 0,
          settings: DEFAULT_SETTINGS,
          codes: { candidate: newInviteCode(), interviewer: newInviteCode(), observer: newInviteCode() },
          notes: (doc.notes ?? []).map((note: Record<string, unknown>) => ({
            ...note,
            authorId: doc.interviewerId,
            authorName: interviewer.name,
            question: 0,
          })),
          snapshots: (doc.snapshots ?? []).map((snapshot: Record<string, unknown>) => ({ ...snapshot, question: 0 })),
          scorecards: doc.verdict
            ? [
                {
                  interviewerId: doc.interviewerId,
                  name: interviewer.name,
                  avatarId: interviewer.avatarId,
                  ratings: doc.ratings ?? {},
                  verdict: doc.verdict,
                  feedback: doc.feedback ?? "",
                  at: doc.updatedAt ?? new Date(),
                },
              ]
            : [],
        },
        $unset: {
          interviewerId: "",
          interviewerName: "",
          interviewerAvatar: "",
          candidateId: "",
          candidateName: "",
          candidateAvatar: "",
          problemSlug: "",
          customTitle: "",
          customPrompt: "",
          customHints: "",
          hintsGiven: "",
          finalCode: "",
          ratings: "",
          verdict: "",
          feedback: "",
        },
      }
    );
  }
  if (legacy.length) console.log(`Interviews: moved ${legacy.length} interview(s) to the multi-question format.`);
}