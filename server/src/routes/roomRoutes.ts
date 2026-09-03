import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { createRoom, listMyRooms, getRoom, deleteRoom } from "../controllers/roomController";

const router = Router();

router.use(requireAuth);

router.post("/", createRoom);
router.get("/", listMyRooms);
router.get("/:id", getRoom);
router.delete("/:id", deleteRoom);

export default router;