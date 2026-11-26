
import { Request, Response } from "express";
import User from "../models/User.js";

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.userId;

    const users = await User.find({
      _id: { $ne: currentUserId },
    }).select(
      "name email bio skillsToTeach skillsToLearn createdAt"
    );

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

export const getSkillMatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentUserId = req.userId;

    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: "Current user not found",
      });
      return;
    }

    const currentUserTeaches = currentUser.skillsToTeach.map((skill) =>
      skill.trim().toLowerCase()
    );

    const currentUserLearns = currentUser.skillsToLearn.map((skill) =>
      skill.trim().toLowerCase()
    );

    const otherUsers = await User.find({
      _id: { $ne: currentUserId },
    }).select(
      "name email bio skillsToTeach skillsToLearn createdAt"
    );

    const matches = otherUsers
      .map((user) => {
        const otherUserTeaches = user.skillsToTeach.map((skill) =>
          skill.trim().toLowerCase()
        );

        const otherUserLearns = user.skillsToLearn.map((skill) =>
          skill.trim().toLowerCase()
        );

        const youCanTeach = currentUserTeaches.filter((skill) =>
          otherUserLearns.includes(skill)
        );

        const theyCanTeach = otherUserTeaches.filter((skill) =>
          currentUserLearns.includes(skill)
        );

        if (
          youCanTeach.length === 0 ||
          theyCanTeach.length === 0
        ) {
          return null;
        }

        return {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            skillsToTeach: user.skillsToTeach,
            skillsToLearn: user.skillsToLearn,
          },
          matchingSkills: {
            youCanTeach,
            theyCanTeach,
          },
        };
      })
      .filter((match) => match !== null);

    res.status(200).json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error("Get skill matches error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve skill matches",
    });
  }
};
