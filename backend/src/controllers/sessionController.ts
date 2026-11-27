
import { Request, Response } from "express";
import mongoose from "mongoose";
import Session from "../models/Session.js";
import ExchangeRequest from "../models/ExchangeRequest.js";
import { createNotification } from "../services/notificationService.js";
import type { NotificationType } from "../models/Notification.js";
const isParticipant = (
  session: {
    sender: mongoose.Types.ObjectId;
    receiver: mongoose.Types.ObjectId;
  },
  userId: string
): boolean => {
  return (
    session.sender.toString() === userId ||
    session.receiver.toString() === userId
  );
};

const getOtherParticipantId = (
  session: {
    sender: mongoose.Types.ObjectId;
    receiver: mongoose.Types.ObjectId;
  },
  userId: string
): string => {
  return session.sender.toString() === userId
    ? session.receiver.toString()
    : session.sender.toString();
};

const notifyOtherParticipant = async (
  session: {
    sender: mongoose.Types.ObjectId;
    receiver: mongoose.Types.ObjectId;
    _id: mongoose.Types.ObjectId;
  },
  actorId: string,
  type: NotificationType,
  title: string,
  message: string
): Promise<void> => {
  await createNotification({
    recipient: getOtherParticipantId(session, actorId),
    actor: actorId,
    type,
    title,
    message,
    relatedSession: session._id,
  });
};

const validateSchedule = (
  scheduledAt: unknown,
  durationMinutes: unknown,
  mode: unknown
): boolean => {
  if (
    typeof scheduledAt !== "string" ||
    typeof durationMinutes !== "number" ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 240 ||
    (mode !== "online" && mode !== "in_person")
  ) {
    return false;
  }

  const date = new Date(scheduledAt);

  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
};

const validateMeetingDetails = (
  meetingDetails: unknown
): string | null => {
  if (meetingDetails === undefined) {
    return "";
  }

  if (
    typeof meetingDetails !== "string" ||
    meetingDetails.trim().length > 500
  ) {
    return null;
  }

  return meetingDetails.trim();
};

// GET /api/sessions
export const getMySessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const sessions = await Session.find({
      $or: [{ sender: req.userId }, { receiver: req.userId }],
    })
      .populate("sender", "name")
      .populate("receiver", "name")
      .populate("proposedBy", "name")
      .sort({ scheduledAt: 1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error("Get sessions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load sessions",
    });
  }
};

// POST /api/sessions
export const proposeSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      exchangeRequestId,
      scheduledAt,
      durationMinutes,
      mode,
      meetingDetails,
    } = req.body;

    if (!mongoose.isValidObjectId(exchangeRequestId)) {
      res.status(400).json({
        success: false,
        message: "Valid exchangeRequestId is required",
      });
      return;
    }

    if (!validateSchedule(scheduledAt, durationMinutes, mode)) {
      res.status(400).json({
        success: false,
        message:
          "Choose a future date/time, duration from 15 to 240 minutes, and a valid session mode",
      });
      return;
    }

    const details = validateMeetingDetails(meetingDetails);

    if (details === null) {
      res.status(400).json({
        success: false,
        message: "Meeting details must be 500 characters or less",
      });
      return;
    }

    const exchangeRequest = await ExchangeRequest.findById(
      exchangeRequestId
    );

    if (!exchangeRequest) {
      res.status(404).json({
        success: false,
        message: "Exchange request not found",
      });
      return;
    }

    if (exchangeRequest.status !== "accepted") {
      res.status(400).json({
        success: false,
        message: "Only accepted exchanges can be scheduled",
      });
      return;
    }

    const userId = req.userId!;

    if (!isParticipant(exchangeRequest, userId)) {
      res.status(403).json({
        success: false,
        message: "You are not part of this exchange",
      });
      return;
    }

    const existingSession = await Session.findOne({
      exchangeRequest: exchangeRequest._id,
    });

    if (existingSession) {
      res.status(409).json({
        success: false,
        message: "A session already exists. Use reschedule instead.",
      });
      return;
    }

    const session = await Session.create({
      exchangeRequest: exchangeRequest._id,
      sender: exchangeRequest.sender,
      receiver: exchangeRequest.receiver,
      proposedBy: userId,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      mode,
      meetingDetails: details,
      status: "proposed",
    });

    await notifyOtherParticipant(
      session,
      userId,
      "session_proposed",
      "New session proposal",
      "Your exchange partner proposed a learning session."
    );

    res.status(201).json({
      success: true,
      message: "Session proposal created",
      session,
    });
  } catch (error) {
    console.error("Propose session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to propose session",
    });
  }
};

// PATCH /api/sessions/:sessionId/confirm
export const confirmSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
      return;
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        message: "Session not found",
      });
      return;
    }

    const userId = req.userId!;

    if (!isParticipant(session, userId)) {
      res.status(403).json({
        success: false,
        message: "You are not part of this session",
      });
      return;
    }

    if (session.proposedBy.toString() === userId) {
      res.status(403).json({
        success: false,
        message: "The other participant must confirm the proposal",
      });
      return;
    }

    if (
      session.status !== "proposed" &&
      session.status !== "reschedule_requested"
    ) {
      res.status(400).json({
        success: false,
        message: "This session cannot be confirmed",
      });
      return;
    }

    session.status = "confirmed";
    await session.save();

    await notifyOtherParticipant(
      session,
      userId,
      "session_confirmed",
      "Session confirmed",
      "Your exchange partner confirmed the session."
    );

    res.status(200).json({
      success: true,
      message: "Session confirmed",
      session,
    });
  } catch (error) {
    console.error("Confirm session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to confirm session",
    });
  }
};

// PATCH /api/sessions/:sessionId/reschedule
export const rescheduleSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const {
      scheduledAt,
      durationMinutes,
      mode,
      meetingDetails,
    } = req.body;

    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
      return;
    }

    if (!validateSchedule(scheduledAt, durationMinutes, mode)) {
      res.status(400).json({
        success: false,
        message: "Invalid future schedule, duration, or mode",
      });
      return;
    }

    const details = validateMeetingDetails(meetingDetails);

    if (details === null) {
      res.status(400).json({
        success: false,
        message: "Meeting details must be 500 characters or less",
      });
      return;
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        message: "Session not found",
      });
      return;
    }

    const userId = req.userId!;

    if (!isParticipant(session, userId)) {
      res.status(403).json({
        success: false,
        message: "You are not part of this session",
      });
      return;
    }

    if (session.status === "cancelled") {
      res.status(400).json({
        success: false,
        message: "Cancelled sessions cannot be rescheduled",
      });
      return;
    }

    session.scheduledAt = new Date(scheduledAt);
    session.durationMinutes = durationMinutes;
    session.mode = mode;
    session.meetingDetails = details;
    session.proposedBy = new mongoose.Types.ObjectId(userId);
    session.status = "reschedule_requested";

    await session.save();

    await notifyOtherParticipant(
      session,
      userId,
      "session_rescheduled",
      "Session rescheduled",
      "Your exchange partner proposed a new session time."
    );

    res.status(200).json({
      success: true,
      message: "Reschedule proposal sent",
      session,
    });
  } catch (error) {
    console.error("Reschedule session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reschedule session",
    });
  }
};

// PATCH /api/sessions/:sessionId/cancel
export const cancelSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
      return;
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        message: "Session not found",
      });
      return;
    }

    const userId = req.userId!;

    if (!isParticipant(session, userId)) {
      res.status(403).json({
        success: false,
        message: "You are not part of this session",
      });
      return;
    }

    if (session.status === "cancelled") {
      res.status(400).json({
        success: false,
        message: "Session is already cancelled",
      });
      return;
    }

    session.status = "cancelled";
    await session.save();

    await notifyOtherParticipant(
      session,
      userId,
      "session_cancelled",
      "Session cancelled",
      "Your exchange partner cancelled the session."
    );

    res.status(200).json({
      success: true,
      message: "Session cancelled",
      session,
    });
  } catch (error) {
    console.error("Cancel session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to cancel session",
    });
  }
};
