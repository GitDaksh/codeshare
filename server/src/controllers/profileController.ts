import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { Profile } from "../models/Profile";

const DEFAULT_AVATAR_ID = "rings-0";

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

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { avatarId } = req.body;

    if (!avatarId || typeof avatarId !== "string") {
      return res.status(400).json({ error: "avatarId is required" });
    }

    const profile = await Profile.findOneAndUpdate(
      { clerkUserId: userId },
      { avatarId },
      { new: true, upsert: true }
    );

    res.json(profile);
  } catch (err) {
    next(err);
  }
}