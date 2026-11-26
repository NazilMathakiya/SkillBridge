
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  sendExchangeRequest,
  getReceivedRequests,
  getSentRequests,
  respondToExchangeRequest,
} from "../controllers/exchangeRequestController.js";

const router = Router();

router.use(authMiddleware);

router.post("/", sendExchangeRequest);
router.get("/received", getReceivedRequests);
router.get("/sent", getSentRequests);
router.patch("/:requestId/respond", respondToExchangeRequest);

export default router;
