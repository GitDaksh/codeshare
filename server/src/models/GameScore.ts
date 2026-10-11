import { Schema, model, Document } from "mongoose";

// One row per person per game: their best score, how often they've played
// and how often they've won (against friends). Leaderboards read straight
// from these.
export interface IGameScore extends Document {
  userId: string;
  game: string;
  best: number;
  bestAt: Date | null;
  plays: number;
  wins: number;
  lastPlayedAt: Date;
}

const gameScoreSchema = new Schema<IGameScore>({
  userId: { type: String, required: true },
  game: { type: String, required: true },
  best: { type: Number, default: 0 },
  bestAt: { type: Date, default: null },
  plays: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  lastPlayedAt: { type: Date, default: Date.now },
});

gameScoreSchema.index({ userId: 1, game: 1 }, { unique: true });
// The leaderboards' sorts (ties go to whoever got there first).
gameScoreSchema.index({ game: 1, best: -1, bestAt: 1 });
gameScoreSchema.index({ game: 1, wins: -1, lastPlayedAt: 1 });

export const GameScore = model<IGameScore>("GameScore", gameScoreSchema);
