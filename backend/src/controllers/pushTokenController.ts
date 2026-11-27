
import { Request, Response } from "express";
import User from "../models/User.js";

export const registerPushToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        success: false,
        message: "Push token is required",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $addToSet: {
          expoPushTokens: token.trim(),
        },
      },
      {
        new: true,
      }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (error) {
    console.error("Register push token error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to register push token",
    });
  }
};
