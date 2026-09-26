import { Schema, model, Document } from "mongoose";

const DEFAULT_AVATAR_ID = "codeshare";

export interface ISolvedProblem {
  slug: string;
  language: string;
  solvedAt: Date;
}

export interface IProfile extends Document {
  clerkUserId: string;
  username: string;
  avatarId: string;
  bio: string;
  favoriteLanguage: string;
  githubUsername: string;
  recentRoomIds: string[];
  solvedProblems: ISolvedProblem[];
  createdAt: Date;
  updatedAt: Date;
}

const solvedProblemSchema = new Schema<ISolvedProblem>(
  {
    slug: { type: String, required: true },
    language: { type: String, required: true },
    solvedAt: { type: Date, required: true },
  },
  { _id: false }
);

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
    recentRoomIds: {
      type: [String],
      default: [],
    },
    // Practice progress: one entry per problem, recorded the first time all
    // of its tests pass.
    solvedProblems: {
      type: [solvedProblemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

profileSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $gt: "" } } }
);

export const Profile = model<IProfile>("Profile", profileSchema);