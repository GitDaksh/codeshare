import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, gameLobbies, gameResults, leaderboardRequests, limitRequests } from "../lib/rateLimit";
import { createGameLobby, getGameStats, getLeaderboard, recordResult } from "../controllers/gameController";

const router = Router();

// Leaderboards are public, like the Games page itself.
router.get("/leaderboard/:game", limitRequests(leaderboardRequests), getLeaderboard);

router.use(requireAuth, limitRequests(apiRequests));

router.post("/lobbies", limitRequests(gameLobbies), createGameLobby);
router.post("/results", limitRequests(gameResults), recordResult);
router.get("/stats", getGameStats);

export default router;
