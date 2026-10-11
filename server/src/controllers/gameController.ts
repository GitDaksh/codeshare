import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { GameScore } from "../models/GameScore";
import { Profile } from "../models/Profile";
import { GAMES, isGame } from "../lib/games";
import { leaderboards, saveResult } from "../lib/gameResults";
import { createLobby } from "../sockets/games";

const DEFAULT_AVATAR_ID = "codeshare";
const LEADERBOARD_SIZE = 10;
// Leaderboards are read from the database at most this often (per game).
const LEADERBOARD_CACHE_MS = 15_000;

// POST /api/games/lobbies { game, settings }: a new lobby for friends to
// join. The host connects to it right after (sockets/games.ts).
export async function createGameLobby(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { game, settings } = req.body ?? {};
    if (!isGame(game)) return res.status(400).json({ error: "Unknown game" });
    const result = createLobby(userId, game, settings);
    if ("error" in result) {
      return result.error === "too-many"
        ? res.status(429).json({ error: "You have too many games open. Finish or leave one first." })
        : res.status(503).json({ error: "Too many games right now. Try again in a minute." });
    }
    res.status(201).json({ code: result.code });
  } catch (err) {
    next(err);
  }
}

// POST /api/games/results { game, score }: one finished solo game. Counts the
// play and keeps the score if it's a new personal best. (Games with friends
// are saved by the server itself when they end, wins included.)
export async function recordResult(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { game, score } = req.body ?? {};
    if (!isGame(game)) return res.status(400).json({ error: "Unknown game" });
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > GAMES[game].maxScore) {
      return res.status(400).json({ error: "Invalid score" });
    }
    res.json(await saveResult(userId, game, score, false));
  } catch (err) {
    next(err);
  }
}

// GET /api/games/stats: your best, plays and wins for every game you've played.
export async function getGameStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const rows = await GameScore.find({ userId }).lean();
    const stats: Record<string, { best: number; plays: number; wins: number }> = {};
    for (const row of rows) stats[row.game] = { best: row.best, plays: row.plays, wins: row.wins };
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

// GET /api/games/leaderboard/:game: the top players (public). Ranked by best
// score, or by wins against friends for Four in a Row.
export async function getLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    const game = req.params.game;
    if (!isGame(game)) return res.status(404).json({ error: "Unknown game" });
    const field = GAMES[game].rankBy === "wins" ? "wins" : "best";
    let board = leaderboards.get(game);
    if (!board || Date.now() - board.at > LEADERBOARD_CACHE_MS) {
      // Ties go to whoever got there first.
      const sort: Record<string, 1 | -1> = field === "best" ? { best: -1, bestAt: 1 } : { wins: -1, lastPlayedAt: 1 };
      const rows = await GameScore.find({ game, [field]: { $gt: 0 } })
        .sort(sort)
        .limit(LEADERBOARD_SIZE)
        .select("userId best wins")
        .lean();
      const profiles = await Profile.find({ clerkUserId: { $in: rows.map((r) => r.userId) } })
        .select("clerkUserId username avatarId")
        .lean();
      const byId = new Map(profiles.map((p) => [p.clerkUserId, p]));
      board = {
        at: Date.now(),
        rows: rows.map((row) => {
          const profile = byId.get(row.userId);
          return {
            userId: row.userId,
            username: profile?.username || "anonymous",
            avatarId: profile?.avatarId || DEFAULT_AVATAR_ID,
            value: field === "wins" ? row.wins : row.best,
          };
        }),
      };
      leaderboards.set(game, board);
    }
    const { userId } = getAuth(req);
    res.json({
      rankBy: field,
      entries: board.rows.map((row, i) => ({
        rank: i + 1,
        username: row.username,
        avatarId: row.avatarId,
        value: row.value,
        you: !!userId && row.userId === userId,
      })),
    });
  } catch (err) {
    next(err);
  }
}
