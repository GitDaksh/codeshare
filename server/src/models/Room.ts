import { Schema, model, Document } from "mongoose";

export interface IRoom extends Document {
  name: string;
  ownerId: string;
  language: string;
  code: string;
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
  },
  { timestamps: true }
);

export const Room = model<IRoom>("Room", roomSchema);