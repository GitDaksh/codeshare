import { Schema, model, Document } from "mongoose";
import { newInviteCode } from "../lib/inviteCode";

export interface IRoom extends Document {
  name: string;
  ownerId: string;
  language: string;
  code: string;
  problemSlug: string | null;
  inviteCode: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
      enum: ["javascript", "typescript", "python", "cpp", "java"],
      default: "javascript",
    },
    code: {
      type: String,
      default: "",
    },
    // Set when the room was started from a Practice problem.
    problemSlug: {
      type: String,
      default: null,
    },
    // The random code in the room's invite link. Room ids can be guessed
    // (they hold a timestamp and a counter); invite codes can't.
    inviteCode: {
      type: String,
      default: newInviteCode,
    },
    // Everyone who joined with the invite link (not the owner), so their links
    // keep working without it. Never sent to the browser.
    members: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.members;
        return ret;
      },
    },
  }
);

export const Room = model<IRoom>("Room", roomSchema);