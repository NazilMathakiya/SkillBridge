
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import type { NotificationType } from "../models/Notification.js";

interface CreateNotificationInput {
  recipient: string | mongoose.Types.ObjectId;
  actor: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedExchangeRequest?: string | mongoose.Types.ObjectId;
  relatedSession?: string | mongoose.Types.ObjectId;
}

export const createNotification = async (
  input: CreateNotificationInput
): Promise<void> => {
  try {
    await Notification.create({
      recipient: input.recipient,
      actor: input.actor,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedExchangeRequest: input.relatedExchangeRequest,
      relatedSession: input.relatedSession,
    });
  } catch (error) {
    // A notification failure should not undo a successful exchange/session action.
    console.error("Create notification error:", error);
  }
};
