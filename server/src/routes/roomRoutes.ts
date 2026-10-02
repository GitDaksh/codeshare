import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { apiRequests, limitRequests, roomCreations } from "../lib/rateLimit";
import { createRoom, listMyRooms, getRoom, updateRoom, deleteRoom } from "../controllers/roomController";
import { getRoomMessages } from "../controllers/messageController";
import { listPeople, removePerson, resetInvite, setRole } from "../controllers/peopleController";

const router = Router();

router.use(requireAuth, limitRequests(apiRequests));

router.post("/", limitRequests(roomCreations), createRoom);
router.get("/", listMyRooms);
router.get("/:id", getRoom);
router.patch("/:id", updateRoom);
router.delete("/:id", deleteRoom);
router.get("/:id/messages", getRoomMessages);
router.get("/:id/people", listPeople);
router.patch("/:id/people/:userId", setRole);
router.delete("/:id/people/:userId", removePerson);
router.post("/:id/invites", resetInvite);

export default router;