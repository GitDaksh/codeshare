import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";

export async function createRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, language } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const room = await Room.create({
      name: name.trim(),
      ownerId: userId,
      language: language || "javascript",
    });

    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
}

export async function listMyRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rooms = await Room.find({ ownerId: userId }).sort({ updatedAt: -1 });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);

    // Best-effort "recently joined" tracking — fires after the response is
    // already sent, and its own failure can never affect the request above.
    const { userId } = getAuth(req);
    if (userId && room.ownerId !== userId) {
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

    await room.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}