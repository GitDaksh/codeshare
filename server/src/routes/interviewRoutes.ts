import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, limitRequests } from "../lib/rateLimit";
import {
  createInterview,
  deleteInterview,
  finishInterview,
  getInterview,
  joinInterview,
  listInterviews,
  saveScorecard,
  shareInterview,
} from "../controllers/interviewController";

const router = Router();

router.use(requireAuth, limitRequests(apiRequests));

router.post("/", createInterview);
router.get("/", listInterviews);
router.post("/join", joinInterview);
router.get("/:id", getInterview);
router.delete("/:id", deleteInterview);
router.post("/:id/end", finishInterview);
router.post("/:id/scorecard", saveScorecard);
router.post("/:id/share", shareInterview);

export default router;