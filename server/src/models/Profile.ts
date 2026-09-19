import { Schema, model, Document } from "mongoose";

const DEFAULT_AVATAR_ID = "orbit-0";

export interface IProfile extends Document {
  clerkUserId: string;
  username: string;
  avatarId: string;
  bio: string;
  favoriteLanguage: string;
  githubUsername: string;
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
    username: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    avatarId: {
      type: String,
      required: true,
      default: DEFAULT_AVATAR_ID,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    favoriteLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    githubUsername: {
      type: String,
      trim: true,
      maxlength: 39,
      default: "",
    },
  },
  { timestamps: true }
);

profileSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $gt: "" } } }
);

export const Profile = model<IProfile>("Profile", profileSchema);