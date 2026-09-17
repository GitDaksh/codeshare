export type OnlineUser = {
  socketId: string;
  userId: string;
  name: string;
};

export type RemoteCursorEvent = {
  userId: string;
  name: string;
  line: number;
  column: number;
};