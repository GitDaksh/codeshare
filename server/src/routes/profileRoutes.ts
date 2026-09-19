import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getProfile, updateProfile, checkUsername } from "../controllers/profileController";

const router = Router();

router.use(requireAuth);

router.get("/username-available", checkUsername);
router.get("/", getProfile);
router.put("/", updateProfile);

export default router;