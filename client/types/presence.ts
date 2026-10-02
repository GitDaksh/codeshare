import type { RoomRole } from "@/types/room";

export type OnlineUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
  role?: RoomRole;
};

export type TypingEvent = {
  userId: string;
  name: string;
  isTyping: boolean;
};