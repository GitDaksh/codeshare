export type OnlineUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
};

export type RemoteCursorEvent = {
  userId: string;
  name: string;
  line: number;
  column: number;
};

export type TypingEvent = {
  userId: string;
  name: string;
  isTyping: boolean;
};