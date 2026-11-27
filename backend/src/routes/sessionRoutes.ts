
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getMySessions,
  proposeSession,
  confirmSession,
  rescheduleSession,
  cancelSession,
} from "../controllers/sessionController.js";

const router = Router();

router.use(authMiddleware);

router.get("/", getMySessions);
router.post("/", proposeSession);
router.patch("/:sessionId/confirm", confirmSession);
router.patch("/:sessionId/reschedule", rescheduleSession);
router.patch("/:sessionId/cancel", cancelSession);

export default router;
