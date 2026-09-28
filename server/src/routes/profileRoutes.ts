import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, limitRequests } from "../lib/rateLimit";
import {
  getProfile,
  updateProfile,
  checkUsername,
  getRecentRooms,
  markProblemSolved,
} from "../controllers/profileController";

const router = Router();

router.use(requireAuth, limitRequests(apiRequests));

router.get("/username-available", checkUsername);
router.get("/recent-rooms", getRecentRooms);
router.post("/solved", markProblemSolved);
router.get("/", getProfile);
router.put("/", updateProfile);

export default router;