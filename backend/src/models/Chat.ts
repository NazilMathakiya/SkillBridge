
import mongoose, { Schema, Document } from "mongoose";

export interface IChat extends Document {
  exchangeRequest: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  lastMessage: string;
  lastMessageAt?: Date;
}

const chatSchema = new Schema<IChat>(
  {
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRequest",
      required: true,
      unique: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model<IChat>("Chat", chatSchema);

export default Chat;
