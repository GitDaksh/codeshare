export type Room = {
  _id: string;
  name: string;
  ownerId: string;
  language: string;
  code: string;
  // Set when the room was started from a Practice problem.
  problemSlug?: string | null;
  // The random code in the room's invite link: anyone with the link can join.
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
};