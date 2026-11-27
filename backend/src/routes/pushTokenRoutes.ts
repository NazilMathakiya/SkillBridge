
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { registerPushToken } from "../controllers/pushTokenController.js";

const router = Router();

router.use(authMiddleware);

router.post("/", registerPushToken);

export default router;
