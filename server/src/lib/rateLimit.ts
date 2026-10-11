import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export type Limiter = { take: (key: string) => boolean };

// A token bucket per person: up to `burst` actions at once, refilling at
// `perSecond`. It lives in memory (there's one server), so it costs nothing
// and needs no extra service.
export function limiter(burst: number, perSecond: number): Limiter {
  const buckets = new Map<string, { tokens: number; at: number }>();

  const sweep = setInterval(() => {
    // Buckets that have refilled completely can be forgotten.
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.tokens + ((now - bucket.at) / 1000) * perSecond >= burst) buckets.delete(key);
    }
  }, 60_000);
  sweep.unref();

  return {
    take(key) {
      const now = Date.now();
      const bucket = buckets.get(key) ?? { tokens: burst, at: now };
      bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
      bucket.at = now;
      buckets.set(key, bucket);
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}

// Any API request: 120 at once, then 2 a second.
export const apiRequests = limiter(120, 2);
// Creating rooms: 10 at once, then one every 30 seconds.
export const roomCreations = limiter(10, 1 / 30);
// Game lobbies: 10 at once, then one every 10 seconds.
export const gameLobbies = limiter(10, 1 / 10);
// Finished games: 30 at once, then one every 5 seconds.
export const gameResults = limiter(30, 1 / 5);
// Public leaderboards (cached, so cheap): 300 at once, then 10 a second.
export const leaderboardRequests = limiter(300, 10);

// Express middleware (after sign-in is checked): too many requests from one
// person get a 429.
export function limitRequests(rate: Limiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getAuth(req).userId ?? req.ip ?? "unknown";
    if (rate.take(key)) return next();
    res.setHeader("Retry-After", "10");
    res.status(429).json({ error: "Too many requests. Please slow down and try again in a moment." });
  };
}