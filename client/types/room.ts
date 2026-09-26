export type Room = {
  _id: string;
  name: string;
  ownerId: string;
  language: string;
  code: string;
  // Set when the room was started from a Practice problem.
  problemSlug?: string | null;
  createdAt: string;
  updatedAt: string;
};