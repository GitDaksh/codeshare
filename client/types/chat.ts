export type ChatMessage = {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatarId: string;
  text: string;
  createdAt: string;
};