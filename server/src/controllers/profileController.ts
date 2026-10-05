import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { Message } from "../models/Message";
import { Profile } from "../models/Profile";
import { Room } from "../models/Room";

const DEFAULT_AVATAR_ID = "codeshare";
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const PROBLEM_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;
const TESTABLE_LANGUAGES = new Set(["javascript", "typescript", "python"]);

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let profile = await Profile.findOne({ clerkUserId: userId });

    if (!profile) {
      profile = await Profile.create({ clerkUserId: userId, avatarId: DEFAULT_AVATAR_ID });
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function checkUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const username = String(req.query.username || "").toLowerCase().trim();

    if (!USERNAME_PATTERN.test(username)) {
      return res.json({ available: false });
    }

    const existing = await Profile.findOne({ username, clerkUserId: { $ne: userId } });
    res.json({ available: !existing });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { username, avatarId, bio, favoriteLanguage, githubUsername } = req.body;
    const update: Record<string, string> = {};

    if (username !== undefined) {
      const normalized = String(username).toLowerCase().trim();

      if (!USERNAME_PATTERN.test(normalized)) {
        return res.status(400).json({
          error: "Username must be 3-20 characters: lowercase letters, numbers, underscores only.",
        });
      }

      const existing = await Profile.findOne({ username: normalized, clerkUserId: { $ne: userId } });
      if (existing) {
        return res.status(409).json({ error: "That username is already taken." });
      }

      update.username = normalized;
    }

    if (avatarId !== undefined) update.avatarId = String(avatarId);
    if (bio !== undefined) update.bio = String(bio).slice(0, 160);
    if (favoriteLanguage !== undefined) update.favoriteLanguage = String(favoriteLanguage);
    if (githubUsername !== undefined) update.githubUsername = String(githubUsername).slice(0, 39);

    const profile = await Profile.findOneAndUpdate(
      { clerkUserId: userId },
      update,
      { returnDocument: "after", upsert: true }
    );

    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// People by username, for adding them to an interview (at most 8, not you).
export async function searchPeople(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase().replace(/^@/, "") : "";
    if (query.length < 2 || query.length > 30 || !/^[a-z0-9_.-]+$/.test(query)) return res.json([]);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const people = await Profile.find(
      { username: { $regex: `^${escaped}` }, clerkUserId: { $ne: userId } },
      { clerkUserId: 1, username: 1, avatarId: 1 }
    )
      .limit(8)
      .lean();
    res.json(people.map((person) => ({ userId: person.clerkUserId, username: person.username, avatarId: person.avatarId })));
  } catch (err) {
    next(err);
  }
}

export async function getRecentRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await Profile.findOne({ clerkUserId: userId });

    if (!profile || profile.recentRoomIds.length === 0) {
      return res.json([]);
    }

    // Practice rooms never appear here, even ones visited before they
    // stopped being tracked.
    const rooms = await Room.find({
      _id: { $in: profile.recentRoomIds },
      ownerId: { $ne: userId },
      problemSlug: null,
    });

    const roomMap = new Map(rooms.map((r) => [r._id.toString(), r]));
    const ordered = profile.recentRoomIds
      .map((id) => roomMap.get(id))
      .filter((r): r is (typeof rooms)[number] => Boolean(r));

    res.json(ordered);
  } catch (err) {
    next(err);
  }
}

// Records a Practice problem as solved (the first time only). The update is a
// single atomic operation, so two quick requests can never add it twice.
export async function markProblemSolved(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { slug, language } = req.body;

    if (typeof slug !== "string" || !PROBLEM_SLUG_PATTERN.test(slug)) {
      return res.status(400).json({ error: "Invalid problem" });
    }
    if (typeof language !== "string" || !TESTABLE_LANGUAGES.has(language)) {
      return res.status(400).json({ error: "Invalid language" });
    }

    const updated = await Profile.findOneAndUpdate(
      { clerkUserId: userId, "solvedProblems.slug": { $ne: slug } },
      { $push: { solvedProblems: { slug, language, solvedAt: new Date() } } },
      { returnDocument: "after" }
    );

    if (updated) {
      return res.json(updated);
    }

    // Already solved before (or the profile doesn't exist yet).
    const profile = await Profile.findOne({ clerkUserId: userId });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// ---------- The dashboard summary ----------

// The activity chart covers the last 16 weeks, today included.
const ACTIVITY_DAYS = 16 * 7;
// Keeps the work bounded for very chatty accounts; the chart only needs counts per day.
const ACTIVITY_MESSAGE_LIMIT = 10000;
const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;

// Formats a date as "2026-09-29" in the user's own time zone, so "today" on
// the chart matches their calendar. Unknown time zones fall back to UTC.
function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
}

// Everything the user has on CodeShare, summarized for the dashboard. Only
// counts leave the server: never the ids of the people in their rooms.
export async function getProfileStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { tz } = req.query;
    const toDay = dayFormatter(typeof tz === "string" && TIME_ZONE_PATTERN.test(tz) ? tz : "UTC");
    const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);

    const [profile, owned, shared, messages, recentMessages] = await Promise.all([
      Profile.findOne({ clerkUserId: userId }).select("solvedProblems createdAt").lean(),
      Room.find({ ownerId: userId }).select("members language problemSlug createdAt").lean(),
      Room.find({ members: userId, ownerId: { $ne: userId } }).select("ownerId members language problemSlug").lean(),
      Message.countDocuments({ senderId: userId }),
      Message.find({ senderId: userId, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(ACTIVITY_MESSAGE_LIMIT)
        .select("createdAt")
        .lean(),
    ]);

    // Everyone the user has coded with: people who joined their rooms, and the
    // owners and members of the rooms they joined.
    const partners = new Set<string>();
    for (const room of owned) {
      for (const member of room.members ?? []) partners.add(member);
    }
    for (const room of shared) {
      partners.add(room.ownerId);
      for (const member of room.members ?? []) partners.add(member);
    }
    partners.delete(userId);

    const languages = new Map<string, number>();
    for (const room of [...owned, ...shared]) {
      languages.set(room.language, (languages.get(room.language) ?? 0) + 1);
    }

    // An active day is one with a message sent, a problem solved or a room created.
    const activity = new Map<string, number>();
    const countDay = (date: Date | undefined) => {
      if (!date || date < since) return;
      const day = toDay.format(date);
      activity.set(day, (activity.get(day) ?? 0) + 1);
    };
    for (const message of recentMessages) countDay(message.createdAt);
    for (const solved of profile?.solvedProblems ?? []) countDay(solved.solvedAt);
    for (const room of owned) countDay(room.createdAt);

    res.json({
      rooms: owned.filter((room) => !room.problemSlug).length,
      practiceRooms: owned.filter((room) => room.problemSlug).length,
      sharedRooms: shared.filter((room) => !room.problemSlug).length,
      partners: partners.size,
      messages,
      languages: [...languages]
        .map(([language, rooms]) => ({ language, rooms }))
        .sort((a, b) => b.rooms - a.rooms || a.language.localeCompare(b.language)),
      activity: [...activity]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      memberSince: profile?.createdAt ?? null,
    });
  } catch (err) {
    next(err);
  }
}