
import { Router } from "express";
import {
  getAllUsers,
  getSkillMatches,
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.get("/matches", authMiddleware, getSkillMatches);
router.get("/", authMiddleware, getAllUsers);

export default router;
