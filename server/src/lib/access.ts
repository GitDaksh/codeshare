import { timingSafeEqual } from "crypto";
import mongoose from "mongoose";
import { Room, type IRoom } from "../models/Room";
import { Profile } from "../models/Profile";
import { INVITE_CODE, newInviteCode } from "./inviteCode";

// The most people a room remembers (it bounds the room's size in the
// database; anyone with the invite link can still open it).
const MAX_MEMBERS = 1000;

function sameCode(given: string, actual: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The room, if this person may open it: its owner, anyone who joined before,
// or anyone with its invite link (who is remembered from then on, so their
// links keep working without it). To everyone else the room doesn't exist,
// even if they guessed its id.
export async function openRoom(id: unknown, userId: string, invite: unknown): Promise<IRoom | null> {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  const room = await Room.findById(id);
  if (!room) return null;
  if (room.ownerId === userId || room.members.includes(userId)) return room;
  if (typeof invite !== "string" || !INVITE_CODE.test(invite) || !room.inviteCode) return null;
  if (!sameCode(invite, room.inviteCode)) return null;
  if (room.members.length < MAX_MEMBERS) {
    await Room.updateOne({ _id: room._id }, { $addToSet: { members: userId } });
    room.members.push(userId);
  }
  return room;
}

// Rooms made before invite links existed: each gets an invite code, and
// everyone who already visited one counts as a member, so no existing link
// breaks. Runs at startup and does nothing once every room has a code.
export async function prepareRooms(): Promise<void> {
  const missing = await Room.find(
    { $or: [{ inviteCode: { $exists: false } }, { inviteCode: null }, { inviteCode: "" }] },
    { _id: 1 },
  ).lean();
  if (!missing.length) return;

  for (const room of missing) {
    await Room.updateOne({ _id: room._id }, { $set: { inviteCode: newInviteCode() } });
  }

  const prepared = new Set(missing.map((room) => room._id.toString()));
  const visitors = await Profile.find({ "recentRoomIds.0": { $exists: true } }, { clerkUserId: 1, recentRoomIds: 1 }).lean();
  for (const visitor of visitors) {
    const visited = visitor.recentRoomIds.filter((id) => prepared.has(id));
    if (visited.length) {
      await Room.updateMany({ _id: { $in: visited } }, { $addToSet: { members: visitor.clerkUserId } });
    }
  }
  console.log(`Invite links: prepared ${missing.length} existing room(s).`);
}