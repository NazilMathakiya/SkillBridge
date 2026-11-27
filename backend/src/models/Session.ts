
import mongoose, { Schema, Document } from "mongoose";

export type SessionStatus =
  | "proposed"
  | "confirmed"
  | "reschedule_requested"
  | "cancelled";

export type SessionMode = "online" | "in_person";

export interface ISession extends Document {
  exchangeRequest: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  proposedBy: mongoose.Types.ObjectId;
  scheduledAt: Date;
  durationMinutes: number;
  mode: SessionMode;
  meetingDetails: string;
  status: SessionStatus;
}

const sessionSchema = new Schema<ISession>(
  {
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRequest",
      required: true,
      unique: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
      max: 240,
    },
    mode: {
      type: String,
      enum: ["online", "in_person"],
      required: true,
    },
    meetingDetails: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "proposed",
        "confirmed",
        "reschedule_requested",
        "cancelled",
      ],
      default: "proposed",
    },
  },
  { timestamps: true }
);

sessionSchema.index({ sender: 1, scheduledAt: 1 });
sessionSchema.index({ receiver: 1, scheduledAt: 1 });

const Session = mongoose.model<ISession>("Session", sessionSchema);

export default Session;
