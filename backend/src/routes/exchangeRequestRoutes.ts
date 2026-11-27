
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  sendExchangeRequest,
  getReceivedRequests,
  getSentRequests,
  respondToExchangeRequest,
} from "../controllers/exchangeRequestController.js";

const router = Router();

// All exchange-request routes require authentication.
router.use(authMiddleware);

// Send a new exchange request
router.post("/", sendExchangeRequest);

// Get requests received by the logged-in user
router.get("/received", getReceivedRequests);

// Get requests sent by the logged-in user
router.get("/sent", getSentRequests);

// Accept or reject an exchange request
router.patch("/:requestId/respond", respondToExchangeRequest);

export default router;
