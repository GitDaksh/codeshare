export type Reaction = {
  emoji: string;
  userId: string;
};

export type ChatMessage = {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatarId: string;
  text: string;
  reactions: Reaction[];
  createdAt: string;
};