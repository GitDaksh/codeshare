import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, limitRequests, roomCreations } from "../lib/rateLimit";
import { createRoom, listMyRooms, getRoom, updateRoom, deleteRoom } from "../controllers/roomController";
import { getRoomMessages } from "../controllers/messageController";

const router = Router();

router.use(requireAuth, limitRequests(apiRequests));

router.post("/", limitRequests(roomCreations), createRoom);
router.get("/", listMyRooms);
router.get("/:id", getRoom);
router.patch("/:id", updateRoom);
router.delete("/:id", deleteRoom);
router.get("/:id/messages", getRoomMessages);

export default router;