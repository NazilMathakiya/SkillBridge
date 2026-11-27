
import { Request, Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

// GET /api/notifications
export const getMyNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requestedLimit = Number(req.query.limit) || 30;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.userId })
        .populate("actor", "name")
        .populate(
          "relatedExchangeRequest",
          "offeredSkill wantedSkill status"
        )
        .populate(
          "relatedSession",
          "scheduledAt status durationMinutes mode"
        )
        .sort({ createdAt: -1 })
        .limit(limit),
      Notification.countDocuments({
        recipient: req.userId,
        read: false,
      }),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications",
    });
  }
};

// PATCH /api/notifications/:notificationId/read
export const markNotificationAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: req.userId,
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.userId,
        read: false,
      },
      {
        read: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
    });
  }
};
