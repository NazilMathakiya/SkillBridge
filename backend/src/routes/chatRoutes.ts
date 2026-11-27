
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getMyChats,
  getChatMessages,
} from "../controllers/chatController.js";

const router = Router();

router.use(authMiddleware);

router.get("/", getMyChats);
router.get("/:chatId/messages", getChatMessages);

export default router;
