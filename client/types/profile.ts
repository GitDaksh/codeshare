export type SolvedProblem = {
  slug: string;
  language: string;
  solvedAt: string;
};

export type Profile = {
  _id: string;
  clerkUserId: string;
  username: string;
  avatarId: string;
  bio: string;
  favoriteLanguage: string;
  githubUsername: string;
  recentRoomIds?: string[];
  solvedProblems?: SolvedProblem[];
  createdAt: string;
  updatedAt: string;
};

// The dashboard summary (GET /api/profile/stats). Only counts: never the ids
// of the people in the user's rooms.
export type ProfileStats = {
  rooms: number;
  practiceRooms: number;
  sharedRooms: number;
  partners: number;
  messages: number;
  languages: { language: string; rooms: number }[];
  // Days with activity in the last 16 weeks, as "2026-09-29" in the user's time zone.
  activity: { date: string; count: number }[];
  memberSince: string | null;
};