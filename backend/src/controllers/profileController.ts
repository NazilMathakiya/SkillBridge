
import { Request, Response } from "express";
import User from "../models/User.js";

// Get the logged-in user's profile
export const getMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        skillsToTeach: user.skillsToTeach,
        skillsToLearn: user.skillsToLearn,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
};

// Update the logged-in user's profile
export const updateMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      bio,
      skillsToTeach,
      skillsToLearn,
    } = req.body;

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Name must be a non-empty string",
      });
      return;
    }

    if (bio !== undefined && typeof bio !== "string") {
      res.status(400).json({
        success: false,
        message: "Bio must be a string",
      });
      return;
    }

    if (
      skillsToTeach !== undefined &&
      (!Array.isArray(skillsToTeach) ||
        !skillsToTeach.every((skill) => typeof skill === "string"))
    ) {
      res.status(400).json({
        success: false,
        message: "Skills to teach must be an array of strings",
      });
      return;
    }

    if (
      skillsToLearn !== undefined &&
      (!Array.isArray(skillsToLearn) ||
        !skillsToLearn.every((skill) => typeof skill === "string"))
    ) {
      res.status(400).json({
        success: false,
        message: "Skills to learn must be an array of strings",
      });
      return;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (skillsToTeach !== undefined) {
      user.skillsToTeach = skillsToTeach
        .map((skill: string) => skill.trim().toLowerCase())
        .filter((skill: string) => skill.length > 0);
    }

    if (skillsToLearn !== undefined) {
      user.skillsToLearn = skillsToLearn
        .map((skill: string) => skill.trim().toLowerCase())
        .filter((skill: string) => skill.length > 0);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        skillsToTeach: user.skillsToTeach,
        skillsToLearn: user.skillsToLearn,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};
