import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Message } from "../models/Message";

export async function getRoomMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Room not found" });
    }

    const messages = await Message.find({ roomId: id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    next(err);
  }
}