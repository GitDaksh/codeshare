import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import { Message } from "../models/Message";
import {
  Interview,
  INTERVIEW_CRITERIA,
  INTERVIEW_LEVELS,
  INTERVIEW_VERDICTS,
  type IInterview,
  type IInterviewPerson,
  type IInterviewQuestion,
  type InterviewCriterion,
  type InterviewVerdict,
} from "../models/Interview";
import { openRoom, roleOf } from "../lib/access";
import { INVITE_CODE, newInviteCode } from "../lib/inviteCode";
import {
  COUNTDOWN_MS,
  DEFAULT_SETTINGS,
  MAX_INTERVIEWERS,
  MAX_QUESTIONS,
  interviewListItem,
  interviewReport,
  isActive,
  isCandidate,
  isInterviewer,
  isStale,
  publicInterview,
} from "../lib/interviews";
import { broadcastInterview, endInterview, openInterview, resetRoomCode, serial } from "../sockets/interview";
import { applyRoleLive, roomChanged } from "../sockets";

const PROBLEM_SLUG = /^[a-z0-9-]{1,80}$/;
const USER_ID = /^[A-Za-z0-9_]{1,64}$/;
const USERNAME = /^[A-Za-z0-9_.-]{1,40}$/;
const ALLOWED_LANGUAGES = new Set(["javascript", "typescript", "python", "cpp", "java"]);
const MAX_STARTER_CHARS = 100_000;
// Interviews someone has set up that haven't happened yet.
const MAX_UPCOMING = 20;

type Body = Record<string, unknown>;

class BadRequest extends Error {}

function text(value: unknown, max: number, field: string, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new BadRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new BadRequest(`${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new BadRequest(`${field} is required`);
  if (trimmed.length > max) throw new BadRequest(`${field} is too long`);
  return trimmed || null;
}

// One question as the builder (or the in-room setup) sends it.
function parseQuestion(raw: unknown, number: number): IInterviewQuestion {
  if (!raw || typeof raw !== "object") throw new BadRequest(`Question ${number} is missing`);
  const q = raw as Body;
  if (!Number.isInteger(q.minutes) || (q.minutes as number) < 5 || (q.minutes as number) > 120) {
    throw new BadRequest(`Question ${number}: pick 5 to 120 minutes`);
  }
  if (q.starter !== undefined && (typeof q.starter !== "string" || q.starter.length > MAX_STARTER_CHARS)) {
    throw new BadRequest(`Question ${number}: the starter code is too long`);
  }
  const base = {
    minutes: q.minutes as number,
    status: "pending" as const,
    hintsGiven: 0,
    timeSpentMs: 0,
    starter: typeof q.starter === "string" ? q.starter : "",
    code: "",
  };
  if (typeof q.problemSlug === "string" && PROBLEM_SLUG.test(q.problemSlug)) {
    return { ...base, problemSlug: q.problemSlug, title: null, prompt: null, hints: [], answer: null };
  }
  const hints = q.hints === undefined ? [] : q.hints;
  if (!Array.isArray(hints) || hints.length > 5) throw new BadRequest(`Question ${number}: up to 5 hints`);
  return {
    ...base,
    problemSlug: null,
    title: text(q.title, 120, `Question ${number}'s title`, true),
    prompt: text(q.prompt, 5000, `Question ${number}'s description`, true),
    hints: hints.map((hint, i) => text(hint, 500, `Question ${number}, hint ${i + 1}`, true) as string),
    answer: text(q.answer, 2000, `Question ${number}'s answer key`),
  };
}

function parseSettings(raw: unknown, solo: boolean) {
  const given = raw && typeof raw === "object" ? (raw as Body) : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(settings) as (keyof typeof settings)[]) {
    if (typeof given[key] === "boolean") settings[key] = given[key] as boolean;
  }
  // Nobody to monitor when you're practicing alone.
  if (solo) settings.monitoring = false;
  return settings;
}

async function personFor(userId: string): Promise<IInterviewPerson> {
  const profile = await Profile.findOne({ clerkUserId: userId }, { username: 1, avatarId: 1 }).lean();
  return { userId, name: profile?.username || "Someone", avatarId: profile?.avatarId || "codeshare" };
}

async function personByUsername(username: unknown, field: string): Promise<IInterviewPerson> {
  if (typeof username !== "string" || !USERNAME.test(username.trim())) throw new BadRequest(`${field}: unknown username`);
  const profile = await Profile.findOne({ username: username.trim().toLowerCase() }, { clerkUserId: 1, username: 1, avatarId: 1 }).lean();
  if (!profile) throw new BadRequest(`${field}: nobody is called @${username.trim()}`);
  return { userId: profile.clerkUserId, name: profile.username, avatarId: profile.avatarId || "codeshare" };
}

function newCodes() {
  return { candidate: newInviteCode(), interviewer: newInviteCode(), observer: newInviteCode() };
}

// Creates an interview. With a roomId: in a room you own, starting right
// away (the room's Interview button). Without: in a new room of its own,
// waiting in the lobby until an interviewer starts it (the builder).
export async function createInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = (req.body ?? {}) as Body;
    if (body.mode !== "live" && body.mode !== "solo") throw new BadRequest("Mode must be live or solo");
    const solo = body.mode === "solo";
    const title = text(body.title, 120, "Title", true) as string;
    if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > MAX_QUESTIONS) {
      throw new BadRequest(`Pick 1 to ${MAX_QUESTIONS} questions`);
    }
    const questions = body.questions.map((question, index) => parseQuestion(question, index + 1));
    const settings = parseSettings(body.settings, solo);
    const totalMinutes = questions.reduce((sum, question) => sum + question.minutes, 0);
    const durationMin = body.durationMin === undefined ? totalMinutes : body.durationMin;
    if (!Number.isInteger(durationMin) || (durationMin as number) < 5 || (durationMin as number) > 300) {
      throw new BadRequest("Pick a length between 5 and 300 minutes");
    }
    const me = await personFor(userId);

    // ---------- In a room you already own ----------
    if (body.roomId !== undefined) {
      const room = await openRoom(body.roomId, userId, undefined);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (roleOf(room, userId) !== "owner") {
        return res.status(403).json({ error: "Only the room owner can start an interview" });
      }
      let candidateId = userId;
      if (!solo) {
        const chosen = body.candidateId;
        if (typeof chosen !== "string" || !USER_ID.test(chosen) || chosen === userId) {
          throw new BadRequest("Pick someone in the room as the candidate");
        }
        if (!room.members.includes(chosen)) throw new BadRequest("The candidate has to join the room first");
        candidateId = chosen;
      }

      const roomId = room._id.toString();
      const created = await serial(roomId, async () => {
        const existing = await openInterview(roomId);
        if (existing) {
          if (!isStale(existing)) return null;
          await endInterview(existing);
        }
        // The candidate needs to type: a viewer is made an editor.
        if (!solo && room.viewers.includes(candidateId)) {
          await Room.updateOne({ _id: room._id }, { $pull: { viewers: candidateId } });
          applyRoleLive(roomId, candidateId, "editor");
        }
        questions[0].status = "active";
        const interview = await Interview.create({
          roomId: room._id,
          mode: solo ? "solo" : "live",
          title,
          organizerId: userId,
          interviewers: [me],
          candidate: solo ? me : await personFor(candidateId),
          language: room.language,
          questions,
          durationMs: (durationMin as number) * 60 * 1000,
          status: "running",
          startedAt: new Date(Date.now() + COUNTDOWN_MS),
          settings,
          codes: newCodes(),
          events: [{ type: "start", at: 0, question: 0 }],
        });
        if (body.cleanStart === true) await resetRoomCode(roomId, questions[0].starter);
        broadcastInterview(interview);
        return interview;
      });
      if (!created) return res.status(409).json({ error: "An interview is already running in this room" });
      return res.status(201).json(interviewReport(created, true));
    }

    // ---------- In a new room of its own ----------
    if (typeof body.language !== "string" || !ALLOWED_LANGUAGES.has(body.language)) throw new BadRequest("Pick a language");
    const position = text(body.position, 80, "Position");
    const level = body.level === undefined || body.level === null || body.level === "" ? null : body.level;
    if (level !== null && !INTERVIEW_LEVELS.includes(level as (typeof INTERVIEW_LEVELS)[number])) {
      throw new BadRequest("Unknown level");
    }
    let scheduledFor: Date | null = null;
    if (body.scheduledFor !== undefined && body.scheduledFor !== null && body.scheduledFor !== "") {
      const when = new Date(String(body.scheduledFor));
      if (Number.isNaN(when.getTime())) throw new BadRequest("That date doesn't look right");
      scheduledFor = when;
    }
    const upcoming = await Interview.countDocuments({ organizerId: userId, status: "scheduled" });
    if (upcoming >= MAX_UPCOMING) {
      throw new BadRequest(`You have ${MAX_UPCOMING} interviews that haven't happened yet. Finish or delete a few first.`);
    }

    // The people, picked by username (anyone else can join with a link).
    const interviewers: IInterviewPerson[] = [me];
    let candidate: IInterviewPerson | null = solo ? me : null;
    if (!solo && body.candidateUsername !== undefined && body.candidateUsername !== "") {
      candidate = await personByUsername(body.candidateUsername, "Candidate");
      if (candidate.userId === userId) throw new BadRequest("You can't interview yourself (try a mock interview)");
    }
    const others = body.interviewerUsernames === undefined ? [] : body.interviewerUsernames;
    if (solo && Array.isArray(others) && others.length) throw new BadRequest("A mock interview is just you");
    if (!Array.isArray(others) || others.length > MAX_INTERVIEWERS - 1) {
      throw new BadRequest(`Up to ${MAX_INTERVIEWERS - 1} other interviewers`);
    }
    for (const username of others) {
      const person = await personByUsername(username, "Interviewer");
      if (person.userId === candidate?.userId) throw new BadRequest(`@${person.name} can't be both interviewer and candidate`);
      if (!interviewers.some((existing) => existing.userId === person.userId)) interviewers.push(person);
    }

    const members = [...interviewers.map((person) => person.userId), ...(candidate ? [candidate.userId] : [])].filter(
      (id) => id !== userId
    );
    const room = await Room.create({
      name: title,
      ownerId: userId,
      language: body.language,
      code: questions[0].starter,
      members: [...new Set(members)],
    });
    const interview = await Interview.create({
      roomId: room._id,
      mode: solo ? "solo" : "live",
      title,
      position,
      level: level as string | null,
      organizerId: userId,
      interviewers,
      candidate,
      invitedCandidateId: solo ? null : (candidate?.userId ?? null),
      language: body.language,
      questions,
      durationMs: (durationMin as number) * 60 * 1000,
      status: "scheduled",
      scheduledFor,
      settings,
      codes: newCodes(),
    });
    await Room.updateOne({ _id: room._id }, { $set: { interviewId: interview._id } });
    res.status(201).json(interviewReport(interview, true));
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    next(err);
  }
}

// Your interviews: as an interviewer (or the organizer), or as the candidate.
export async function listInterviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const interviews = await Interview.find(
      { $or: [{ organizerId: userId }, { "interviewers.userId": userId }, { "candidate.userId": userId }] },
      { notes: 0, snapshots: 0, events: 0, "questions.code": 0, "questions.starter": 0, "questions.prompt": 0 }
    )
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(interviews.map((interview) => interviewListItem(interview, userId)));
  } catch (err) {
    next(err);
  }
}

async function findInterview(req: Request, res: Response): Promise<{ interview: IInterview; userId: string } | null> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const { id } = req.params;
  const interview = typeof id === "string" && mongoose.isValidObjectId(id) ? await Interview.findById(id) : null;
  if (!interview || (!isInterviewer(interview, userId) && !isCandidate(interview, userId) && interview.organizerId !== userId)) {
    res.status(404).json({ error: "Interview not found" });
    return null;
  }
  return { interview, userId };
}

// One interview. Interviewers see everything (the links included). The
// candidate sees the details before it starts and while it runs, and the
// report once it's over and shared; never the notes or the answer keys.
export async function getInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (isInterviewer(interview, userId)) return res.json(interviewReport(interview, true));
    if (interview.status !== "ended") return res.json({ ...publicInterview(interview, false), viewer: "candidate" });
    if (!interview.shared) return res.status(403).json({ error: "The interviewers haven't shared this report yet" });
    res.json(interviewReport(interview, false));
  } catch (err) {
    next(err);
  }
}

// Opens an invite link: as the candidate, an interviewer, or an observer.
export async function joinInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { code } = (req.body ?? {}) as Body;
    if (typeof code !== "string" || !INVITE_CODE.test(code)) return res.status(404).json({ error: "This link doesn't work" });

    const found = await Interview.findOne({
      $or: [{ "codes.candidate": code }, { "codes.interviewer": code }, { "codes.observer": code }],
    });
    if (!found) return res.status(404).json({ error: "This link doesn't work anymore" });
    const role = found.codes.candidate === code ? "candidate" : found.codes.interviewer === code ? "interviewer" : "observer";
    const roomId = found.roomId.toString();

    const result = await serial(roomId, async () => {
      const interview = await Interview.findById(found._id);
      const room = await Room.findById(roomId);
      if (!interview || !room) return { status: 404, error: "This interview no longer exists" };

      let joinedAs: "candidate" | "interviewer" | "observer" = role;
      if (isInterviewer(interview, userId)) joinedAs = "interviewer";
      else if (isCandidate(interview, userId)) joinedAs = "candidate";
      else if (role === "candidate") {
        if (interview.status === "ended") return { status: 410, error: "This interview is over" };
        // A link the organizer made for someone in particular.
        if (interview.invitedCandidateId && interview.invitedCandidateId !== userId) {
          return { status: 403, error: "This link is for someone else" };
        }
        if (interview.candidate) return { status: 409, error: "This interview already has a candidate" };
        interview.candidate = await personFor(userId);
      } else if (role === "interviewer") {
        if (interview.interviewers.length >= MAX_INTERVIEWERS) return { status: 409, error: "This interview has enough interviewers" };
        interview.interviewers.push(await personFor(userId));
      }

      // The room: interviewers and the candidate can type; observers watch.
      const editor = joinedAs !== "observer";
      if (room.ownerId !== userId) {
        const update = editor
          ? { $addToSet: { members: userId }, $pull: { viewers: userId } }
          : room.members.includes(userId)
            ? null
            : { $addToSet: { members: userId, viewers: userId } };
        if (update) await Room.updateOne({ _id: room._id }, update);
        if (editor && room.viewers.includes(userId)) applyRoleLive(roomId, userId, "editor");
      }
      await interview.save();
      broadcastInterview(interview);
      roomChanged(roomId);
      return { status: 200, body: { interviewId: interview._id.toString(), roomId, role: joinedAs } };
    });

    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json(result.body);
  } catch (err) {
    next(err);
  }
}

// Ends an interview (the live room usually does this; this is the fallback,
// and how an organizer cancels one that never started).
export async function finishInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (!isInterviewer(interview, userId)) return res.status(403).json({ error: "Only an interviewer can end it" });
    const ended = await serial(interview.roomId.toString(), async () => {
      const fresh = await Interview.findById(interview._id);
      if (fresh && fresh.status !== "ended") await endInterview(fresh);
      return fresh;
    });
    res.json(interviewReport(ended ?? interview, true));
  } catch (err) {
    next(err);
  }
}

// An interviewer's scorecard (one each): a rating for each criterion, a
// verdict, and feedback for the candidate. The organizer can also share the
// report with the candidate from here.
export async function saveScorecard(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (!isInterviewer(interview, userId)) {
      return res.status(403).json({ error: "Only an interviewer can fill in a scorecard" });
    }
    if (interview.status !== "ended") return res.status(409).json({ error: "End the interview first" });

    const { ratings, verdict, feedback, shared } = (req.body ?? {}) as {
      ratings?: Record<string, unknown>;
      verdict?: unknown;
      feedback?: unknown;
      shared?: unknown;
    };
    const clean = {} as Record<InterviewCriterion, number>;
    for (const criterion of INTERVIEW_CRITERIA) {
      const value = ratings?.[criterion];
      if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 4) {
        return res.status(400).json({ error: "Rate every criterion from 1 to 4" });
      }
      clean[criterion] = value as number;
    }
    if (!INTERVIEW_VERDICTS.includes(verdict as InterviewVerdict)) {
      return res.status(400).json({ error: "Pick a verdict" });
    }
    if (feedback !== undefined && (typeof feedback !== "string" || feedback.length > 4000)) {
      return res.status(400).json({ error: "Feedback is too long" });
    }

    const author = interview.interviewers.find((person) => person.userId === userId) ?? (await personFor(userId));
    const card = {
      interviewerId: userId,
      name: author.name,
      avatarId: author.avatarId,
      ratings: clean,
      verdict: verdict as InterviewVerdict,
      feedback: typeof feedback === "string" ? feedback.trim() : "",
      at: new Date(),
    };
    const index = interview.scorecards.findIndex((existing) => existing.interviewerId === userId);
    if (index >= 0) interview.scorecards.splice(index, 1, card);
    else interview.scorecards.push(card);
    if (typeof shared === "boolean" && (interview.organizerId === userId || interview.mode === "solo")) {
      interview.shared = shared;
    }
    await interview.save();
    res.json(interviewReport(interview, true));
  } catch (err) {
    next(err);
  }
}

// The organizer shares the report with the candidate (or stops sharing it).
export async function shareInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (interview.organizerId !== userId) return res.status(403).json({ error: "Only the organizer can share the report" });
    const { shared } = (req.body ?? {}) as Body;
    if (typeof shared !== "boolean") return res.status(400).json({ error: "shared must be true or false" });
    interview.shared = shared;
    await interview.save();
    res.json(interviewReport(interview, true));
  } catch (err) {
    next(err);
  }
}

// The organizer deletes an interview that isn't running (and the room made
// for it, with its chat).
export async function deleteInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (interview.organizerId !== userId) return res.status(403).json({ error: "Only the organizer can delete it" });
    if (isActive(interview)) return res.status(409).json({ error: "End the interview first" });
    await Interview.deleteOne({ _id: interview._id });
    const room = await Room.findById(interview.roomId);
    if (room && room.interviewId?.toString() === interview._id.toString()) {
      await Message.deleteMany({ roomId: room._id });
      await room.deleteOne();
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}