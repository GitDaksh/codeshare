import { Schema, model, Document, Types } from "mongoose";
import { newInviteCode } from "../lib/inviteCode";

export interface IRoom extends Document {
  name: string;
  ownerId: string;
  language: string;
  code: string;
  problemSlug: string | null;
  inviteCode: string;
  viewInviteCode: string;
  members: string[];
  viewers: string[];
  yState?: Buffer;
  // Set for a room made for an interview (it lives on the Interviews page).
  interviewId: Types.ObjectId | null;
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
    // The random code in the room's "can edit" invite link (every link shared
    // before roles existed is one of these). Room ids can be guessed (they
    // hold a timestamp and a counter); invite codes can't.
    inviteCode: {
      type: String,
      default: newInviteCode,
    },
    // The random code in the room's "can view" invite link.
    viewInviteCode: {
      type: String,
      default: newInviteCode,
    },
    // Everyone who joined with the invite link (not the owner), so their links
    // keep working without it. Never sent to the browser.
    members: {
      type: [String],
      default: [],
      index: true,
    },
    // The members who can watch but not edit (everyone in members who isn't
    // here can edit). Never sent to the browser.
    viewers: {
      type: [String],
      default: [],
    },
    // The shared document's full edit history (Yjs), so people who reconnect
    // merge their edits instead of duplicating the text. Never sent to
    // browsers, and only loaded when asked for.
    yState: {
      type: Buffer,
      select: false,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    // Who's in a room and its invite codes are left out by default; the
    // routes that may share them add them back (see publicRoom in access.ts).
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.members;
        delete ret.viewers;
        delete ret.inviteCode;
        delete ret.viewInviteCode;
        return ret;
      },
    },
  }
);

export const Room = model<IRoom>("Room", roomSchema);