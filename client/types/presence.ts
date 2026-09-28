export type OnlineUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
};

export type TypingEvent = {
  userId: string;
  name: string;
  isTyping: boolean;
};