import { Schema, model, Document, Types } from "mongoose";

export interface IReaction {
  emoji: string;
  userId: string;
}

export interface IMessage extends Document {
  roomId: Types.ObjectId;
  senderId: string;
  senderName: string;
  senderAvatarId: string;
  text: string;
  reactions: IReaction[];
  createdAt: Date;
}

const reactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatarId: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Message = model<IMessage>("Message", messageSchema);