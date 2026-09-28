import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { Message } from "../models/Message";
import { openRoom } from "../lib/access";

// The newest messages a room loads with (older ones stay stored).
const MESSAGES_SHOWN = 200;

export async function getRoomMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Same rule as the room itself: its owner, members, or the invite link.
    const room = await openRoom(req.params.id, userId, req.query.invite);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const newest = await Message.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(MESSAGES_SHOWN);
    res.json(newest.reverse());
  } catch (err) {
    next(err);
  }
}