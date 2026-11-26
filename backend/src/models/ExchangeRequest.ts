
import mongoose, { Schema, Document } from "mongoose";

export type ExchangeStatus = "pending" | "accepted" | "rejected";

export interface IExchangeRequest extends Document {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  offeredSkill: string;
  wantedSkill: string;
  status: ExchangeStatus;
}

const exchangeRequestSchema = new Schema<IExchangeRequest>(
  {
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

    offeredSkill: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    wantedSkill: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const ExchangeRequest = mongoose.model<IExchangeRequest>(
  "ExchangeRequest",
  exchangeRequestSchema
);

export default ExchangeRequest;
