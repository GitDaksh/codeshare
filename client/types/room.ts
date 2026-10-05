// What you can do in a room: the owner runs it, editors can change the code,
// viewers can watch, follow and chat.
export type RoomRole = "owner" | "editor" | "viewer";

export type Room = {
  _id: string;
  name: string;
  ownerId: string;
  language: string;
  code: string;
  // Set when the room was started from a Practice problem.
  problemSlug?: string | null;
  // Set for a room made for an interview (see the Interviews page).
  interviewId?: string | null;
  // Your role in this room (sent when you open it).
  role?: RoomRole | null;
  // The room's invite links, for people who may invite others (the owner and
  // editors): "edit" lets new people edit, "view" lets them watch.
  invites?: { edit: string; view: string };
  createdAt: string;
  updatedAt: string;
};

// A viewer asking the owner for edit access.
export type AccessRequest = {
  userId: string;
  name: string;
  avatarId: string;
  at: number;
};

// Someone in a room, as listed on the People tab.
export type RoomPerson = {
  userId: string;
  username: string | null;
  avatarId: string | null;
  role: RoomRole;
};