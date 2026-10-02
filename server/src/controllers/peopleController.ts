import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import { openRoom, roleOf, type RoomRole } from "../lib/access";
import { newInviteCode } from "../lib/inviteCode";
import { applyRoleLive, removeLive, roomChanged } from "../sockets";

// Clerk user ids are "user_" followed by letters and digits.
const USER_ID = /^[A-Za-z0-9_]{1,64}$/;
const ORDER: Record<RoomRole, number> = { owner: 0, editor: 1, viewer: 2 };

type Person = { userId: string; username: string | null; avatarId: string | null; role: RoomRole };

// Everyone in the room and their role. Anyone in the room can see it, like
// the list of who's online.
export async function listPeople(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const room = await openRoom(req.params.id, userId, undefined);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const ids = [room.ownerId, ...room.members];
    const profiles = await Profile.find(
      { clerkUserId: { $in: ids } },
      { clerkUserId: 1, username: 1, avatarId: 1 },
    ).lean();
    const byId = new Map(profiles.map((profile) => [profile.clerkUserId, profile]));
    const people: Person[] = ids.map((id) => ({
      userId: id,
      username: byId.get(id)?.username || null,
      avatarId: byId.get(id)?.avatarId || null,
      role: roleOf(room, id) ?? "viewer",
    }));
    people.sort(
      (a, b) => ORDER[a.role] - ORDER[b.role] || (a.username ?? "~").localeCompare(b.username ?? "~"),
    );
    res.json({ people });
  } catch (err) {
    next(err);
  }
}

// The owner makes someone an editor or a viewer. It takes effect at once.
export async function setRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const room = await openRoom(req.params.id, userId, undefined);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.ownerId !== userId) {
      return res.status(403).json({ error: "Only the room owner can change roles" });
    }

    const target = req.params.userId;
    const { role } = (req.body ?? {}) as { role?: unknown };
    if (role !== "editor" && role !== "viewer") {
      return res.status(400).json({ error: "Role must be editor or viewer" });
    }
    if (typeof target !== "string" || !USER_ID.test(target)) {
      return res.status(404).json({ error: "That person isn't in this room" });
    }
    if (target === room.ownerId) {
      return res.status(400).json({ error: "The owner's role can't be changed" });
    }
    if (!room.members.includes(target)) {
      return res.status(404).json({ error: "That person isn't in this room" });
    }

    await Room.updateOne(
      { _id: room._id },
      role === "viewer" ? { $addToSet: { viewers: target } } : { $pull: { viewers: target } },
    );
    applyRoleLive(room._id.toString(), target, role);
    res.json({ userId: target, role });
  } catch (err) {
    next(err);
  }
}

// The owner removes someone, or someone leaves. Removing someone also
// replaces both invite links, so the links they had stop working (everyone
// already in the room is unaffected). Leaving doesn't change the links.
export async function removePerson(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const room = await openRoom(req.params.id, userId, undefined);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const target = req.params.userId;
    const leaving = target === userId;
    if (!leaving && room.ownerId !== userId) {
      return res.status(403).json({ error: "Only the room owner can remove people" });
    }
    if (typeof target !== "string" || !USER_ID.test(target)) {
      return res.status(404).json({ error: "That person isn't in this room" });
    }
    if (target === room.ownerId) {
      return res.status(400).json({ error: "The owner can't leave their own room. Delete it instead." });
    }
    if (!room.members.includes(target)) {
      return res.status(404).json({ error: "That person isn't in this room" });
    }

    await Room.updateOne(
      { _id: room._id },
      {
        $pull: { members: target, viewers: target },
        ...(leaving ? {} : { $set: { inviteCode: newInviteCode(), viewInviteCode: newInviteCode() } }),
      },
    );
    // Off their "Recently joined" list too.
    await Profile.updateOne({ clerkUserId: target }, { $pull: { recentRoomIds: room._id.toString() } }).catch(
      () => {},
    );
    removeLive(room._id.toString(), target);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// The owner replaces one invite link. Anyone who joined with the old one
// stays; the old link just stops letting new people in.
export async function resetInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const room = await openRoom(req.params.id, userId, undefined);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.ownerId !== userId) {
      return res.status(403).json({ error: "Only the room owner can reset invite links" });
    }

    const { kind } = (req.body ?? {}) as { kind?: unknown };
    if (kind !== "edit" && kind !== "view") {
      return res.status(400).json({ error: "Link must be edit or view" });
    }
    if (kind === "edit") room.inviteCode = newInviteCode();
    else room.viewInviteCode = newInviteCode();
    await Room.updateOne(
      { _id: room._id },
      { $set: kind === "edit" ? { inviteCode: room.inviteCode } : { viewInviteCode: room.viewInviteCode } },
    );
    roomChanged(room._id.toString());
    res.json({ invites: { edit: room.inviteCode, view: room.viewInviteCode } });
  } catch (err) {
    next(err);
  }
}