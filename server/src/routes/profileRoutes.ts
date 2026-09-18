import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getProfile, updateProfile } from "../controllers/profileController";

const router = Router();

router.use(requireAuth);

router.get("/", getProfile);
router.put("/", updateProfile);

export default router;