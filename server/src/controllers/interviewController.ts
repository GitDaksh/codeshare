import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import {
  Interview,
  INTERVIEW_CRITERIA,
  INTERVIEW_VERDICTS,
  type IInterview,
  type InterviewCriterion,
  type InterviewVerdict,
} from "../models/Interview";
import { openRoom, roleOf } from "../lib/access";
import { COUNTDOWN_MS, interviewReport, isActive, isStale } from "../lib/interviews";
import { activeInterview, broadcastInterview, endInterview, serial } from "../sockets/interview";
import { applyRoleLive } from "../sockets";

const PROBLEM_SLUG = /^[a-z0-9-]{1,80}$/;
const USER_ID = /^[A-Za-z0-9_]{1,64}$/;

// Starts an interview in a room you own: with someone in the room as the
// candidate ("live"), or by yourself ("solo").
export async function createInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { roomId, mode, candidateId, problemSlug, customTitle, customPrompt, durationMin } = (req.body ?? {}) as {
      roomId?: unknown;
      mode?: unknown;
      candidateId?: unknown;
      problemSlug?: unknown;
      customTitle?: unknown;
      customPrompt?: unknown;
      durationMin?: unknown;
    };
    if (mode !== "live" && mode !== "solo") return res.status(400).json({ error: "Mode must be live or solo" });

    const room = await openRoom(roomId, userId, undefined);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (roleOf(room, userId) !== "owner") {
      return res.status(403).json({ error: "Only the room owner can start an interview" });
    }

    if (!Number.isInteger(durationMin) || (durationMin as number) < 5 || (durationMin as number) > 180) {
      return res.status(400).json({ error: "Pick a length between 5 and 180 minutes" });
    }

    const usesProblem = typeof problemSlug === "string" && PROBLEM_SLUG.test(problemSlug);
    const usesCustom =
      typeof customTitle === "string" &&
      customTitle.trim().length > 0 &&
      customTitle.length <= 120 &&
      typeof customPrompt === "string" &&
      customPrompt.length <= 5000;
    if (usesProblem === usesCustom) {
      return res.status(400).json({ error: "Pick a Practice problem or write your own question" });
    }

    let candidate = userId;
    if (mode === "live") {
      if (typeof candidateId !== "string" || !USER_ID.test(candidateId) || candidateId === userId) {
        return res.status(400).json({ error: "Pick someone in the room as the candidate" });
      }
      if (!room.members.includes(candidateId)) {
        return res.status(400).json({ error: "The candidate has to join the room first" });
      }
      candidate = candidateId;
    }

    const id = room._id.toString();
    const interview = await serial(id, async () => {
      const existing = await activeInterview(id);
      if (existing) {
        if (!isStale(existing)) return null;
        await endInterview(existing);
      }

      // The candidate needs to type: a viewer is made an editor.
      if (mode === "live" && room.viewers.includes(candidate)) {
        await Room.updateOne({ _id: room._id }, { $pull: { viewers: candidate } });
        applyRoleLive(id, candidate, "editor");
      }

      const profiles = await Profile.find(
        { clerkUserId: { $in: [userId, candidate] } },
        { clerkUserId: 1, username: 1, avatarId: 1 }
      ).lean();
      const who = (clerkUserId: string) => profiles.find((profile) => profile.clerkUserId === clerkUserId);

      const created = await Interview.create({
        roomId: room._id,
        mode,
        interviewerId: userId,
        interviewerName: who(userId)?.username || "Interviewer",
        interviewerAvatar: who(userId)?.avatarId || "codeshare",
        candidateId: candidate,
        candidateName: who(candidate)?.username || "Candidate",
        candidateAvatar: who(candidate)?.avatarId || "codeshare",
        problemSlug: usesProblem ? problemSlug : null,
        customTitle: usesCustom ? (customTitle as string).trim() : null,
        customPrompt: usesCustom ? (customPrompt as string).trim() : null,
        language: room.language,
        durationMs: (durationMin as number) * 60 * 1000,
        startedAt: new Date(Date.now() + COUNTDOWN_MS),
        events: [{ type: "start", at: 0 }],
      });
      broadcastInterview(created);
      return created;
    });

    if (!interview) return res.status(409).json({ error: "An interview is already running in this room" });
    res.status(201).json(interviewReport(interview, true));
  } catch (err) {
    next(err);
  }
}

// Your interviews, as the interviewer or the candidate, newest first.
export async function listInterviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const interviews = await Interview.find(
      { $or: [{ interviewerId: userId }, { candidateId: userId }] },
      { notes: 0, snapshots: 0, finalCode: 0, events: 0, customPrompt: 0, customHints: 0 }
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(
      interviews.map((interview) => {
        const asInterviewer = interview.interviewerId === userId;
        return {
          id: interview._id.toString(),
          roomId: interview.roomId.toString(),
          mode: interview.mode,
          role: asInterviewer ? "interviewer" : "candidate",
          problemSlug: interview.problemSlug,
          customTitle: interview.customTitle,
          status: interview.status,
          startedAt: interview.startedAt,
          endedAt: interview.endedAt,
          durationMs: interview.durationMs,
          verdict: asInterviewer || interview.shared ? interview.verdict : null,
          interviewer: { name: interview.interviewerName, avatarId: interview.interviewerAvatar },
          candidate: { name: interview.candidateName, avatarId: interview.candidateAvatar },
        };
      })
    );
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
  if (!interview || (interview.interviewerId !== userId && interview.candidateId !== userId)) {
    res.status(404).json({ error: "Interview not found" });
    return null;
  }
  return { interview, userId };
}

// The report. The candidate can read it once the interview is over and the
// interviewer has shared it; the interviewer's private notes stay private.
export async function getInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (interview.interviewerId === userId) return res.json(interviewReport(interview, true));
    if (interview.status !== "ended" || !interview.shared) {
      return res.status(403).json({ error: "The interviewer hasn't shared this report yet" });
    }
    res.json(interviewReport(interview, false));
  } catch (err) {
    next(err);
  }
}

// Ends an interview (the live room usually does this; this is the fallback).
export async function finishInterview(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (interview.interviewerId !== userId) return res.status(403).json({ error: "Only the interviewer can end it" });
    const ended = await serial(interview.roomId.toString(), async () => {
      const fresh = await Interview.findById(interview._id);
      if (fresh && isActive(fresh)) await endInterview(fresh);
      return fresh;
    });
    res.json(interviewReport(ended ?? interview, true));
  } catch (err) {
    next(err);
  }
}

// The interviewer's scorecard: a rating for each criterion, a verdict,
// feedback for the candidate, and whether the candidate can read the report.
export async function saveScorecard(req: Request, res: Response, next: NextFunction) {
  try {
    const found = await findInterview(req, res);
    if (!found) return;
    const { interview, userId } = found;
    if (interview.interviewerId !== userId) {
      return res.status(403).json({ error: "Only the interviewer can fill in the scorecard" });
    }
    if (interview.status !== "ended") return res.status(409).json({ error: "End the interview first" });

    const { ratings, verdict, feedback, shared } = (req.body ?? {}) as {
      ratings?: Record<string, unknown>;
      verdict?: unknown;
      feedback?: unknown;
      shared?: unknown;
    };
    const clean: Partial<Record<InterviewCriterion, number>> = {};
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

    interview.ratings = clean;
    interview.verdict = verdict as InterviewVerdict;
    interview.feedback = typeof feedback === "string" ? feedback.trim() : "";
    interview.shared = shared !== false;
    await interview.save();
    res.json(interviewReport(interview, true));
  } catch (err) {
    next(err);
  }
}