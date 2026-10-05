import { Schema, model, Document, Types } from "mongoose";

// An interview: who's interviewing whom, the questions, the clock, and
// everything that happened (for the live room and the report).

export const INTERVIEW_PHASES = ["intro", "coding", "testing", "wrapup"] as const;
export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];
// "scheduled": created, waiting in the lobby for someone to start it.
export type InterviewStatus = "scheduled" | "running" | "paused" | "ended";
export const INTERVIEW_VERDICTS = ["strong-no", "no", "yes", "strong-yes"] as const;
export type InterviewVerdict = (typeof INTERVIEW_VERDICTS)[number];
export const INTERVIEW_CRITERIA = ["problemSolving", "coding", "communication", "testing"] as const;
export type InterviewCriterion = (typeof INTERVIEW_CRITERIA)[number];
export const INTERVIEW_LEVELS = ["Intern", "Junior", "Mid-level", "Senior", "Staff"] as const;

export type InterviewEventType =
  | "start"
  | "phase"
  | "question"
  | "hint"
  | "pause"
  | "resume"
  | "extend"
  | "tests"
  | "complexity"
  | "done"
  | "monitor"
  | "end";

// Something that happened, stamped with interview time (milliseconds since
// the start, not counting pauses), and the question it happened during.
export interface IInterviewEvent {
  type: InterviewEventType;
  at: number;
  question?: number;
  data?: Record<string, unknown>;
}

export interface IInterviewPerson {
  userId: string;
  name: string;
  avatarId: string;
}

export interface IInterviewQuestion {
  // A Practice problem, or the interviewer's own question.
  problemSlug: string | null;
  title: string | null;
  prompt: string | null;
  // Own questions: hints written ahead (or live), and an answer key only
  // interviewers see.
  hints: string[];
  answer: string | null;
  minutes: number;
  status: "pending" | "active" | "done";
  hintsGiven: number;
  timeSpentMs: number;
  // The code the question starts with, and the candidate's code for it
  // (saved whenever the interview moves to another question).
  starter: string;
  code: string;
}

export interface IInterviewNote {
  at: number;
  text: string;
  tag?: string;
  authorId: string;
  authorName: string;
  question: number;
}

export interface IInterviewSnapshot {
  at: number;
  label: string;
  code: string;
  question: number;
}

export interface IInterviewScorecard {
  interviewerId: string;
  name: string;
  avatarId: string;
  ratings: Record<InterviewCriterion, number>;
  verdict: InterviewVerdict;
  feedback: string;
  at: Date;
}

export interface IInterviewSettings {
  // Interviewers can give hints.
  hints: boolean;
  // The candidate can run the tests.
  runTests: boolean;
  // The candidate can visualize with Lens.
  lens: boolean;
  // The Big-O meter is shown.
  meter: boolean;
  // Tab switches, pastes and the like are recorded (the candidate is told).
  monitoring: boolean;
}

export interface IInterview extends Document {
  roomId: Types.ObjectId;
  // "live": interviewers and a candidate. "solo": you, practicing alone.
  mode: "live" | "solo";
  title: string;
  position: string | null;
  level: string | null;
  organizerId: string;
  interviewers: IInterviewPerson[];
  candidate: IInterviewPerson | null;
  // The person the candidate link is for, when the organizer picked them.
  invitedCandidateId: string | null;
  language: string;
  questions: IInterviewQuestion[];
  current: number;
  // Interview time when the current question became active.
  currentSince: number;
  durationMs: number;
  extraMs: number;
  status: InterviewStatus;
  scheduledFor: Date | null;
  // When the clock starts (a few seconds after "Start", for the countdown).
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedMs: number;
  endedAt: Date | null;
  phase: InterviewPhase;
  settings: IInterviewSettings;
  // The invite links' codes. Only interviewers ever see them.
  codes: { candidate: string; interviewer: string; observer: string };
  events: IInterviewEvent[];
  // Shared between the interviewers; never sent to the candidate.
  notes: IInterviewNote[];
  snapshots: IInterviewSnapshot[];
  scorecards: IInterviewScorecard[];
  // Whether the candidate can read the report.
  shared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const personSchema = new Schema<IInterviewPerson>(
  { userId: { type: String, required: true }, name: String, avatarId: String },
  { _id: false }
);

const questionSchema = new Schema<IInterviewQuestion>(
  {
    problemSlug: { type: String, default: null },
    title: { type: String, default: null, maxlength: 120 },
    prompt: { type: String, default: null, maxlength: 5000 },
    hints: { type: [String], default: [] },
    answer: { type: String, default: null, maxlength: 2000 },
    minutes: { type: Number, required: true },
    status: { type: String, enum: ["pending", "active", "done"], default: "pending" },
    hintsGiven: { type: Number, default: 0 },
    timeSpentMs: { type: Number, default: 0 },
    starter: { type: String, default: "" },
    code: { type: String, default: "" },
  },
  { _id: false }
);

const interviewSchema = new Schema<IInterview>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    mode: { type: String, enum: ["live", "solo"], required: true },
    title: { type: String, required: true, maxlength: 120 },
    position: { type: String, default: null, maxlength: 80 },
    level: { type: String, default: null },
    organizerId: { type: String, required: true, index: true },
    interviewers: { type: [personSchema], default: [] },
    candidate: { type: personSchema, default: null },
    invitedCandidateId: { type: String, default: null },
    language: { type: String, required: true },
    questions: { type: [questionSchema], default: [] },
    current: { type: Number, default: 0 },
    currentSince: { type: Number, default: 0 },
    durationMs: { type: Number, required: true },
    extraMs: { type: Number, default: 0 },
    status: { type: String, enum: ["scheduled", "running", "paused", "ended"], default: "scheduled" },
    scheduledFor: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    pausedMs: { type: Number, default: 0 },
    endedAt: { type: Date, default: null },
    phase: { type: String, enum: INTERVIEW_PHASES, default: "intro" },
    settings: {
      hints: { type: Boolean, default: true },
      runTests: { type: Boolean, default: true },
      lens: { type: Boolean, default: false },
      meter: { type: Boolean, default: true },
      monitoring: { type: Boolean, default: true },
    },
    codes: {
      candidate: { type: String, required: true },
      interviewer: { type: String, required: true },
      observer: { type: String, required: true },
    },
    events: {
      type: [{ _id: false, type: { type: String }, at: Number, question: Number, data: Schema.Types.Mixed }],
      default: [],
    },
    notes: {
      type: [{ _id: false, at: Number, text: String, tag: String, authorId: String, authorName: String, question: Number }],
      default: [],
    },
    snapshots: { type: [{ _id: false, at: Number, label: String, code: String, question: Number }], default: [] },
    scorecards: {
      type: [
        {
          _id: false,
          interviewerId: String,
          name: String,
          avatarId: String,
          ratings: Schema.Types.Mixed,
          verdict: { type: String, enum: INTERVIEW_VERDICTS },
          feedback: { type: String, maxlength: 4000 },
          at: Date,
        },
      ],
      default: [],
    },
    shared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A room's current interview; everyone's lists; the invite links.
interviewSchema.index({ roomId: 1, status: 1 });
interviewSchema.index({ "interviewers.userId": 1 });
interviewSchema.index({ "candidate.userId": 1 });
interviewSchema.index({ "codes.candidate": 1 });
interviewSchema.index({ "codes.interviewer": 1 });
interviewSchema.index({ "codes.observer": 1 });

export const Interview = model<IInterview>("Interview", interviewSchema);