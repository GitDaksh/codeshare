import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { Profile } from "../models/Profile";

const DEFAULT_AVATAR_ID = "orbit-0";
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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