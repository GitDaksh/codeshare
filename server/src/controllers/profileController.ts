import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
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
      { new: true, upsert: true }
    );

    res.json(profile);
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
      { new: true }
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