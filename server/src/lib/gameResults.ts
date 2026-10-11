import { GameScore } from "../models/GameScore";

export type SavedResult = { best: number; plays: number; wins: number; newBest: boolean };

// Each game's leaderboard as last read (controllers/gameController.ts),
// cleared when someone's best or wins change.
export type BoardRow = { userId: string; username: string; avatarId: string; value: number };
export const leaderboards = new Map<string, { at: number; rows: BoardRow[] }>();

// Saves one finished game for one person: counts the play (and the win),
// and keeps the score if it's a new personal best. Wins only come from
// online matches, which the server sees end (sockets/games.ts).
export async function saveResult(userId: string, game: string, stat: number | null, won: boolean): Promise<SavedResult> {
  const now = new Date();
  const update = { $inc: { plays: 1, wins: won ? 1 : 0 }, $set: { lastPlayedAt: now } };
  let row;
  try {
    row = await GameScore.findOneAndUpdate({ userId, game }, update, { upsert: true, returnDocument: "after" });
  } catch (err) {
    // Two results for a first game at the same moment: the other one
    // created the row, so this one just updates it.
    if ((err as { code?: number })?.code !== 11000) throw err;
    row = await GameScore.findOneAndUpdate({ userId, game }, update, { returnDocument: "after" });
  }
  const points = stat === null ? 0 : Math.max(0, Math.round(stat));
  let newBest = false;
  if (row && points > row.best) {
    const updated = await GameScore.updateOne({ _id: row._id, best: { $lt: points } }, { $set: { best: points, bestAt: now } });
    newBest = updated.modifiedCount > 0;
  }
  if (newBest || won) leaderboards.delete(game);
  return { best: Math.max(row?.best ?? 0, points), plays: row?.plays ?? 1, wins: row?.wins ?? 0, newBest };
}
