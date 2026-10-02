import { Schema, model, Document, Types } from "mongoose";

// A mock interview held in a room: who's interviewing whom, on what, the
// clock, and everything that happened (for the live bar and the report).

export const INTERVIEW_PHASES = ["intro", "coding", "testing", "wrapup"] as const;
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];
export type InterviewStatus = "running" | "paused" | "ended";
export const INTERVIEW_VERDICTS = ["strong-no", "no", "yes", "strong-yes"] as const;
export type InterviewVerdict = (typeof INTERVIEW_VERDICTS)[number];
export const INTERVIEW_CRITERIA = ["problemSolving", "coding", "communication", "testing"] as const;
export type InterviewCriterion = (typeof INTERVIEW_CRITERIA)[number];

// Something that happened, stamped with interview time (milliseconds since
// the start, not counting pauses), so the report's timeline lines up.
export interface IInterviewEvent {
  type: "start" | "phase" | "hint" | "pause" | "resume" | "extend" | "tests" | "complexity" | "done" | "end";
  at: number;
  data?: Record<string, unknown>;
}

export interface IInterviewNote {
  at: number;
  text: string;
  tag?: string;
}

export interface IInterviewSnapshot {
  at: number;
  label: string;
  code: string;
}

export interface IInterview extends Document {
  roomId: Types.ObjectId;
  // "live": an interviewer and a candidate. "solo": you, practicing alone.
  mode: "live" | "solo";
  interviewerId: string;
  interviewerName: string;
  interviewerAvatar: string;
  candidateId: string;
  candidateName: string;
  candidateAvatar: string;
  // A Practice problem, or the interviewer's own question.
  problemSlug: string | null;
  customTitle: string | null;
  customPrompt: string | null;
  language: string;
  durationMs: number;
  extraMs: number;
  status: InterviewStatus;
  // When the clock starts (a few seconds after creation, for the countdown).
  startedAt: Date;
  pausedAt: Date | null;
  pausedMs: number;
  phase: InterviewPhase;
  hintsGiven: number;
  // Hints the interviewer wrote for their own question, in the order given.
  customHints: string[];
  events: IInterviewEvent[];
  // Only ever sent to the interviewer.
  notes: IInterviewNote[];
  snapshots: IInterviewSnapshot[];
  finalCode: string;
  ratings: Partial<Record<InterviewCriterion, number>> | null;
  verdict: InterviewVerdict | null;
  feedback: string;
  // Whether the candidate can read the report (set with the scorecard).
  shared: boolean;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const interviewSchema = new Schema<IInterview>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    mode: { type: String, enum: ["live", "solo"], required: true },
    interviewerId: { type: String, required: true, index: true },
    interviewerName: { type: String, default: "Interviewer" },
    interviewerAvatar: { type: String, default: "codeshare" },
    candidateId: { type: String, required: true, index: true },
    candidateName: { type: String, default: "Candidate" },
    candidateAvatar: { type: String, default: "codeshare" },
    problemSlug: { type: String, default: null },
    customTitle: { type: String, default: null, maxlength: 120 },
    customPrompt: { type: String, default: null, maxlength: 5000 },
    language: { type: String, required: true },
    durationMs: { type: Number, required: true },
    extraMs: { type: Number, default: 0 },
    status: { type: String, enum: ["running", "paused", "ended"], default: "running" },
    startedAt: { type: Date, required: true },
    pausedAt: { type: Date, default: null },
    pausedMs: { type: Number, default: 0 },
    phase: { type: String, enum: INTERVIEW_PHASES, default: "intro" },
    hintsGiven: { type: Number, default: 0 },
    customHints: { type: [String], default: [] },
    events: {
      type: [{ _id: false, type: { type: String }, at: Number, data: Schema.Types.Mixed }],
      default: [],
    },
    notes: { type: [{ _id: false, at: Number, text: String, tag: String }], default: [] },
    snapshots: { type: [{ _id: false, at: Number, label: String, code: String }], default: [] },
    finalCode: { type: String, default: "" },
    ratings: { type: Schema.Types.Mixed, default: null },
    verdict: { type: String, enum: [...INTERVIEW_VERDICTS, null], default: null },
    feedback: { type: String, default: "", maxlength: 4000 },
    shared: { type: Boolean, default: false },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Finding a room's current interview.
interviewSchema.index({ roomId: 1, status: 1 });

export const Interview = model<IInterview>("Interview", interviewSchema);