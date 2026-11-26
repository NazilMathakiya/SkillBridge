
import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import ExchangeRequest from "../models/ExchangeRequest.js";

const normalizeSkill = (skill: string): string =>
  skill.trim().toLowerCase();

export const sendExchangeRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = req.userId;
    const { receiverId, offeredSkill, wantedSkill } = req.body;

    if (
      typeof receiverId !== "string" ||
      typeof offeredSkill !== "string" ||
      typeof wantedSkill !== "string" ||
      !receiverId.trim() ||
      !offeredSkill.trim() ||
      !wantedSkill.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "receiverId, offeredSkill, and wantedSkill are required",
      });
      return;
    }

    if (!mongoose.isValidObjectId(receiverId)) {
      res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
      return;
    }

    if (receiverId === senderId) {
      res.status(400).json({
        success: false,
        message: "You cannot send an exchange request to yourself",
      });
      return;
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      res.status(404).json({
        success: false,
        message: "Sender or receiver not found",
      });
      return;
    }

    const offered = normalizeSkill(offeredSkill);
    const wanted = normalizeSkill(wantedSkill);

    const senderTeaches = sender.skillsToTeach.map(normalizeSkill);
    const senderLearns = sender.skillsToLearn.map(normalizeSkill);
    const receiverTeaches = receiver.skillsToTeach.map(normalizeSkill);
    const receiverLearns = receiver.skillsToLearn.map(normalizeSkill);

    const validExchange =
      senderTeaches.includes(offered) &&
      senderLearns.includes(wanted) &&
      receiverTeaches.includes(wanted) &&
      receiverLearns.includes(offered);

    if (!validExchange) {
      res.status(400).json({
        success: false,
        message: "These skills do not form a reciprocal exchange",
      });
      return;
    }

    const existingRequest = await ExchangeRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      offeredSkill: offered,
      wantedSkill: wanted,
      status: "pending",
    });

    if (existingRequest) {
      res.status(409).json({
        success: false,
        message: "A pending request already exists for this exchange",
      });
      return;
    }

    const exchangeRequest = await ExchangeRequest.create({
      sender: senderId,
      receiver: receiverId,
      offeredSkill: offered,
      wantedSkill: wanted,
    });

    res.status(201).json({
      success: true,
      message: "Exchange request sent successfully",
      request: exchangeRequest,
    });
  } catch (error) {
    console.error("Send exchange request error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send exchange request",
    });
  }
};

export const getReceivedRequests = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requests = await ExchangeRequest.find({
      receiver: req.userId,
    })
      .populate("sender", "name email bio skillsToTeach skillsToLearn")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get received requests error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve received requests",
    });
  }
};

export const getSentRequests = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const requests = await ExchangeRequest.find({
      sender: req.userId,
    })
      .populate("receiver", "name email bio skillsToTeach skillsToLearn")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get sent requests error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve sent requests",
    });
  }
};

export const respondToExchangeRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(requestId)) {
      res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
      return;
    }

    if (status !== "accepted" && status !== "rejected") {
      res.status(400).json({
        success: false,
        message: "Status must be accepted or rejected",
      });
      return;
    }

    const exchangeRequest = await ExchangeRequest.findById(requestId);

    if (!exchangeRequest) {
      res.status(404).json({
        success: false,
        message: "Exchange request not found",
      });
      return;
    }

    if (exchangeRequest.receiver.toString() !== req.userId) {
      res.status(403).json({
        success: false,
        message: "Only the receiver can respond to this request",
      });
      return;
    }

    if (exchangeRequest.status !== "pending") {
      res.status(400).json({
        success: false,
        message: "This request has already been responded to",
      });
      return;
    }

    exchangeRequest.status = status;
    await exchangeRequest.save();

    res.status(200).json({
      success: true,
      message: `Exchange request ${status}`,
      request: exchangeRequest,
    });
  } catch (error) {
    console.error("Respond to exchange request error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to respond to exchange request",
    });
  }
};
