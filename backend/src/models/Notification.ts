
import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "exchange_request_received"
  | "exchange_request_accepted"
  | "exchange_request_rejected"
  | "session_proposed"
  | "session_confirmed"
  | "session_rescheduled"
  | "session_cancelled"
  | "chat_message"
  | "session_reminder";

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedExchangeRequest?: mongoose.Types.ObjectId;
  relatedSession?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "exchange_request_received",
        "exchange_request_accepted",
        "exchange_request_rejected",
        "session_proposed",
        "session_confirmed",
        "session_rescheduled",
        "session_cancelled",
        "chat_message",
        "session_reminder",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    relatedExchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRequest",
    },
    relatedSession: {
      type: Schema.Types.ObjectId,
      ref: "Session",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
