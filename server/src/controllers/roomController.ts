import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import { Message } from "../models/Message";
import { openRoom } from "../lib/access";

const MAX_INITIAL_CODE_LENGTH = 100_000;
const PROBLEM_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;
const ALLOWED_LANGUAGES = new Set(["javascript", "typescript", "python", "cpp", "java"]);
// Plenty for anyone; stops a script from filling the database with rooms.
const MAX_ROOMS_PER_USER = 100;

export async function createRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, language, code, problemSlug } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Room name is required" });
    }

    if (language !== undefined && (typeof language !== "string" || !ALLOWED_LANGUAGES.has(language))) {
      return res.status(400).json({ error: "Invalid language" });
    }

    // Optional: starter code (used by Practice rooms).
    if (code !== undefined && (typeof code !== "string" || code.length > MAX_INITIAL_CODE_LENGTH)) {
      return res.status(400).json({ error: "Invalid starting code" });
    }

    // Optional: the Practice problem this room is for.
    if (
      problemSlug !== undefined &&
      problemSlug !== null &&
      (typeof problemSlug !== "string" || !PROBLEM_SLUG_PATTERN.test(problemSlug))
    ) {
      return res.status(400).json({ error: "Invalid problem" });
    }

    if ((await Room.countDocuments({ ownerId: userId })) >= MAX_ROOMS_PER_USER) {
      return res.status(400).json({
        error: `You have ${MAX_ROOMS_PER_USER} rooms, the most allowed. Delete a few to make new ones.`,
      });
    }

    const room = await Room.create({
      name: name.trim(),
      ownerId: userId,
      language: language || "javascript",
      ...(typeof code === "string" ? { code } : {}),
      ...(typeof problemSlug === "string" ? { problemSlug } : {}),
    });

    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
}

// Lists your regular rooms (the dashboard and profile). Practice rooms stay
// off those lists; a problem's page asks for its own with ?problem=<slug>.
export async function listMyRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { problem } = req.query;

    if (problem !== undefined && (typeof problem !== "string" || !PROBLEM_SLUG_PATTERN.test(problem))) {
      return res.status(400).json({ error: "Invalid problem" });
    }

    // problemSlug: null also matches rooms created before Practice existed.
    const rooms = await Room.find({
      ownerId: userId,
      problemSlug: typeof problem === "string" ? problem : null,
    }).sort({ updatedAt: -1 });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
}

// Opens a room for its owner, anyone who joined before, or anyone with its
// invite link (?invite=…). To everyone else it doesn't exist.
export async function getRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const room = await openRoom(req.params.id, userId, req.query.invite);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);

    // Best-effort "recently joined" tracking: fires after the response is
    // already sent, and its own failure can never affect the request above.
    // Practice rooms aren't tracked, so they never show up on the dashboard.
    if (room.ownerId !== userId && !room.problemSlug) {
      Profile.findOne({ clerkUserId: userId })
        .then((profile) => {
          if (!profile) return;
          const roomIdStr = room._id.toString();
          profile.recentRoomIds = [
            roomIdStr,
            ...profile.recentRoomIds.filter((rid) => rid !== roomIdStr),
          ].slice(0, 10);
          return profile.save();
        })
        .catch((err) => console.error("Failed to record room visit:", err));
    }
  } catch (err) {
    next(err);
  }
}

export async function updateRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({ error: "Only the room owner can update this room" });
    }

    const { name } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Room name is required" });
      }
      room.name = name.trim();
    }

    await room.save();
    res.json(room);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({ error: "Only the room owner can delete this room" });
    }

    // Its chat goes with it.
    await Message.deleteMany({ roomId: room._id });
    await room.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}