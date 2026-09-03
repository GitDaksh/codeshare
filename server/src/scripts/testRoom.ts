import mongoose from "mongoose";
import dotenv from "dotenv";
import { Room } from "../models/Room";

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGODB_URI is empty — set it in server/.env before running this script.");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const room = await Room.create({
    name: "Test room",
    ownerId: "user_test123",
    language: "javascript",
  });

  console.log("Created room:", room.toObject());

  await Room.deleteOne({ _id: room._id });
  console.log("Cleaned up test room");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});