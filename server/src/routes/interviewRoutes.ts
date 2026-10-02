import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, limitRequests } from "../lib/rateLimit";
import {
  createInterview,
  finishInterview,
  getInterview,
  listInterviews,
  saveScorecard,
} from "../controllers/interviewController";

const router = Router();

router.use(requireAuth, limitRequests(apiRequests));

router.post("/", createInterview);
router.get("/", listInterviews);
router.get("/:id", getInterview);
router.post("/:id/end", finishInterview);
router.post("/:id/scorecard", saveScorecard);

export default router;