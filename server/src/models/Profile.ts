import { Schema, model, Document } from "mongoose";

export interface IProfile extends Document {
  clerkUserId: string;
  avatarId: string;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    avatarId: {
      type: String,
      required: true,
      default: "rings-0",
    },
  },
  { timestamps: true }
);

export const Profile = model<IProfile>("Profile", profileSchema);