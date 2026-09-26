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