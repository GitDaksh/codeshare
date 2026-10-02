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

// What someone can do in a room. The owner runs it; editors can do
// everything else to the code; viewers can watch, follow and chat.
export type RoomRole = "owner" | "editor" | "viewer";

export function roleOf(room: IRoom, userId: string): RoomRole | null {
  if (room.ownerId === userId) return "owner";
  if (!room.members.includes(userId)) return null;
  return room.viewers?.includes(userId) ? "viewer" : "editor";
}

export function canEdit(role: RoomRole | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

// The room as the browser sees it: its details, your role, and (for people
// who may invite others) both invite codes.
export function publicRoom(room: IRoom, role: RoomRole | null) {
  return {
    ...room.toJSON(),
    role,
    ...(canEdit(role) ? { invites: { edit: room.inviteCode, view: room.viewInviteCode } } : {}),
  };
}

// The room, if this person may open it: its owner, anyone who joined before,
// or anyone with one of its invite links (who is remembered from then on, so
// their links keep working without it). The "can view" link makes them a
// viewer. Someone already in the room keeps their role whichever link they
// use, so a viewer can't promote themselves with an edit link. To everyone
// else the room doesn't exist, even if they guessed its id.
export async function openRoom(id: unknown, userId: string, invite: unknown): Promise<IRoom | null> {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  const room = await Room.findById(id);
  if (!room) return null;
  if (room.ownerId === userId || room.members.includes(userId)) return room;
  if (typeof invite !== "string" || !INVITE_CODE.test(invite)) return null;

  const editLink = !!room.inviteCode && sameCode(invite, room.inviteCode);
  const viewLink = !editLink && !!room.viewInviteCode && sameCode(invite, room.viewInviteCode);
  if (!editLink && !viewLink) return null;
  if (room.members.length < MAX_MEMBERS) {
    await Room.updateOne(
      { _id: room._id },
      viewLink ? { $addToSet: { members: userId, viewers: userId } } : { $addToSet: { members: userId } },
    );
    room.members.push(userId);
    if (viewLink) room.viewers.push(userId);
  }
  return room;
}

// Rooms made before invite links existed: each gets an invite code, and
// everyone who already visited one counts as a member, so no existing link
// breaks. Rooms made before roles existed get their "can view" link. Runs at
// startup and does nothing once every room has both codes.
export async function prepareRooms(): Promise<void> {
  const withoutViewLink = await Room.find(
    { $or: [{ viewInviteCode: { $exists: false } }, { viewInviteCode: null }, { viewInviteCode: "" }] },
    { _id: 1 },
  ).lean();
  for (const room of withoutViewLink) {
    await Room.updateOne({ _id: room._id }, { $set: { viewInviteCode: newInviteCode() } });
  }
  if (withoutViewLink.length) console.log(`Roles: added view links to ${withoutViewLink.length} existing room(s).`);

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