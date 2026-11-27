
import { Request, Response } from "express";
import mongoose from "mongoose";

import Chat from "../models/Chat.js";
import ExchangeRequest from "../models/ExchangeRequest.js";
import Message from "../models/Message.js";

export const getMyChats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Find all accepted exchanges involving this user.
    const acceptedExchanges = await ExchangeRequest.find({
      status: "accepted",
      $or: [{ sender: userId }, { receiver: userId }],
    }).select("_id sender receiver");

    // Create a chat for accepted exchanges if one doesn't exist.
    // This also supports accepted exchanges created before chat was added.
    await Promise.all(
      acceptedExchanges.map((exchange) =>
        Chat.findOneAndUpdate(
          { exchangeRequest: exchange._id },
          {
            $setOnInsert: {
              exchangeRequest: exchange._id,
              participants: [exchange.sender, exchange.receiver],
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        )
      )
    );

    const chats = await Chat.find({
      participants: userId,
    })
      .populate({
        path: "exchangeRequest",
        select: "sender receiver offeredSkill wantedSkill status",
        populate: [
          { path: "sender", select: "name bio skillsToTeach skillsToLearn" },
          { path: "receiver", select: "name bio skillsToTeach skillsToLearn" },
        ],
      })
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: chats.length,
      chats,
    });
  } catch (error) {
    console.error("Get chats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve chats",
    });
  }
};

export const getChatMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(chatId)) {
      res.status(400).json({
        success: false,
        message: "Invalid chat ID",
      });
      return;
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      res.status(404).json({
        success: false,
        message: "Chat not found",
      });
      return;
    }

    const isParticipant = chat.participants.some(
      (participant) => participant.toString() === userId
    );

    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: "You are not a participant in this chat",
      });
      return;
    }

    // Chat access ends if the exchange is no longer accepted.
    const exchange = await ExchangeRequest.findOne({
      _id: chat.exchangeRequest,
      status: "accepted",
    });

    if (!exchange) {
      res.status(403).json({
        success: false,
        message: "This exchange is not active",
      });
      return;
    }

    const requestedLimit = Number(req.query.limit) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name");

    res.status(200).json({
      success: true,
      count: messages.length,
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error("Get chat messages error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve messages",
    });
  }
};
