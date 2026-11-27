
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Chat from "./models/Chat.js";
import ExchangeRequest from "./models/ExchangeRequest.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

import { createNotification } from "./services/notificationService.js";
import { sendPushNotification } from "./services/pushNotificationService.js";

interface JwtPayload {
  userId: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

export const initializeSocket = (io: Server): void => {
  // Authenticate every socket connection.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (typeof token !== "string" || !token) {
        return next(new Error("Authentication token required"));
      }

      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        return next(new Error("JWT_SECRET is missing"));
      }

      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      if (!decoded.userId) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.userId = decoded.userId;

      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;

    console.log(`User connected to chat: ${userId}`);

    // Join a chat room after validating access.
    socket.on("chat:join", async (data: { chatId?: string }) => {
      try {
        const chatId = data?.chatId;

        if (
          typeof chatId !== "string" ||
          !mongoose.isValidObjectId(chatId)
        ) {
          socket.emit("chat:error", {
            message: "Valid chat ID is required",
          });
          return;
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
          socket.emit("chat:error", {
            message: "Chat not found",
          });
          return;
        }

        const isParticipant = chat.participants.some(
          (participant) => participant.toString() === userId
        );

        if (!isParticipant) {
          socket.emit("chat:error", {
            message: "You are not a participant in this chat",
          });
          return;
        }

        const acceptedExchange = await ExchangeRequest.findOne({
          _id: chat.exchangeRequest,
          status: "accepted",
        });

        if (!acceptedExchange) {
          socket.emit("chat:error", {
            message: "This exchange is not active",
          });
          return;
        }

        socket.join(chatId);

        socket.emit("chat:joined", {
          chatId,
        });
      } catch (error) {
        console.error("Chat join error:", error);

        socket.emit("chat:error", {
          message: "Unable to join chat",
        });
      }
    });

    // Send a message to a validated chat room.
    socket.on(
      "message:send",
      async (data: { chatId?: string; text?: string }) => {
        try {
          const chatId = data?.chatId;
          const text = data?.text?.trim();

          if (
            typeof chatId !== "string" ||
            !mongoose.isValidObjectId(chatId) ||
            typeof text !== "string" ||
            !text
          ) {
            socket.emit("chat:error", {
              message: "Valid chat ID and message text are required",
            });
            return;
          }

          if (text.length > 2000) {
            socket.emit("chat:error", {
              message: "Message cannot exceed 2000 characters",
            });
            return;
          }

          const chat = await Chat.findById(chatId);

          if (!chat) {
            socket.emit("chat:error", {
              message: "Chat not found",
            });
            return;
          }

          const isParticipant = chat.participants.some(
            (participant) => participant.toString() === userId
          );

          if (!isParticipant) {
            socket.emit("chat:error", {
              message: "You are not a participant in this chat",
            });
            return;
          }

          const acceptedExchange = await ExchangeRequest.findOne({
            _id: chat.exchangeRequest,
            status: "accepted",
          });

          if (!acceptedExchange) {
            socket.emit("chat:error", {
              message: "This exchange is not active",
            });
            return;
          }

          // Save the message.
          const message = await Message.create({
            chat: chatId,
            sender: userId,
            text,
          });

          await Chat.findByIdAndUpdate(chatId, {
            lastMessage: text,
            lastMessageAt: message.createdAt,
          });

          const messagePayload = {
            _id: message._id.toString(),
            chat: chatId,
            sender: userId,
            text: message.text,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          };

          // Send the saved message to both participants.
          io.to(chatId).emit("message:new", messagePayload);

          // Create a notification and send a push notification
          // to the other participant.
          try {
            const recipient = chat.participants.find(
              (participant) => participant.toString() !== userId
            );

            if (recipient) {
              const recipientId = recipient.toString();

              const [senderUser, recipientUser] = await Promise.all([
                User.findById(userId).select("name"),
                User.findById(recipientId).select("expoPushTokens"),
              ]);

              const senderName = senderUser?.name || "Someone";

              const notificationTitle = `${senderName} sent you a message`;

              const notificationMessage =
                text.length > 100 ? `${text.substring(0, 97)}...` : text;

              // Save the notification in MongoDB.
              await createNotification({
                recipient: recipientId,
                actor: userId,
                type: "chat_message",
                title: notificationTitle,
                message: notificationMessage,
              });

              // Send push notification to recipient's devices.
              if (recipientUser?.expoPushTokens?.length) {
                await sendPushNotification({
                  tokens: recipientUser.expoPushTokens,
                  title: notificationTitle,
                  body: notificationMessage,
                  data: {
                    type: "chat_message",
                    chatId,
                  },
                });
              }
            }
          } catch (notificationError) {
            // Notification errors must not undo a saved chat message.
            console.error(
              "Chat notification integration error:",
              notificationError
            );
          }
        } catch (error) {
          console.error("Send message error:", error);

          socket.emit("chat:error", {
            message: "Failed to send message",
          });
        }
      }
    );
    // Edit a message. Only its original sender can edit it within 5 minutes.
socket.on(
  "message:edit",
  async (data: { chatId?: string; messageId?: string; text?: string }) => {
    try {
      const chatId = data?.chatId;
      const messageId = data?.messageId;
      const text = data?.text?.trim();

      // Validate input.
      if (
        typeof chatId !== "string" ||
        typeof messageId !== "string" ||
        !mongoose.isValidObjectId(chatId) ||
        !mongoose.isValidObjectId(messageId) ||
        typeof text !== "string" ||
        !text
      ) {
        socket.emit("chat:error", {
          message:
            "Valid chat ID, message ID, and message text are required",
        });
        return;
      }

      // Check maximum message length.
      if (text.length > 2000) {
        socket.emit("chat:error", {
          message: "Message cannot exceed 2000 characters",
        });
        return;
      }

      // Ensure the user has joined this chat.
      if (!socket.rooms.has(chatId)) {
        socket.emit("chat:error", {
          message: "Join the chat before editing a message",
        });
        return;
      }

      // Find chat.
      const chat = await Chat.findById(chatId);

      if (!chat) {
        socket.emit("chat:error", {
          message: "Chat not found",
        });
        return;
      }

      // Check whether the user is a participant.
      const isParticipant = chat.participants.some(
        (participant) => participant.toString() === userId
      );

      if (!isParticipant) {
        socket.emit("chat:error", {
          message: "You are not a participant in this chat",
        });
        return;
      }

      // Ensure the exchange is accepted.
      const acceptedExchange = await ExchangeRequest.findOne({
        _id: chat.exchangeRequest,
        status: "accepted",
      });

      if (!acceptedExchange) {
        socket.emit("chat:error", {
          message: "This exchange is not active",
        });
        return;
      }

      // Find the requested message.
      const message = await Message.findOne({
        _id: messageId,
        chat: chatId,
      });

      if (!message) {
        socket.emit("chat:error", {
          message: "Message not found",
        });
        return;
      }

      // Only the original sender can edit the message.
      if (message.sender.toString() !== userId) {
        socket.emit("chat:error", {
          message: "You can only edit your own messages",
        });
        return;
      }

      // Enforce the five-minute edit limit on the server.
      const messageAge = Date.now() - message.createdAt.getTime();

      if (messageAge < 0 || messageAge > 5 * 60 * 1000) {
        socket.emit("chat:error", {
          message: "The 5-minute edit window has expired",
        });
        return;
      }

      // Update message in MongoDB.
      message.text = text;
      message.editedAt = new Date();

      await message.save();

      // Update chat preview if this is the latest message.
      const latestMessage = await Message.findOne({
        chat: chatId,
      })
        .sort({ createdAt: -1 })
        .select("_id text createdAt");

      if (
        latestMessage &&
        latestMessage._id.toString() === messageId
      ) {
        chat.lastMessage = latestMessage.text;
        chat.lastMessageAt = latestMessage.createdAt;

        await chat.save();
      }

      // Prepare updated message.
      const messagePayload = {
        _id: message._id.toString(),
        chat: chatId,
        sender: message.sender.toString(),
        text: message.text,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt,
      };

      // Notify both participants.
      io.to(chatId).emit("message:edited", {
        chatId,
        message: messagePayload,
      });

    } catch (error) {
      console.error("Edit message error:", error);

      socket.emit("chat:error", {
        message: "Failed to edit message",
      });
    }
  }
);

    // Delete a message. Only its original sender can delete it.
    socket.on(
      "message:delete",
      async (data: { chatId?: string; messageId?: string }) => {
        try {
          const chatId = data?.chatId;
          const messageId = data?.messageId;

          if (
            typeof chatId !== "string" ||
            typeof messageId !== "string" ||
            !mongoose.isValidObjectId(chatId) ||
            !mongoose.isValidObjectId(messageId)
          ) {
            socket.emit("chat:error", {
              message: "Valid chat and message IDs are required",
            });
            return;
          }

          // Require the socket to have joined this chat room.
          if (!socket.rooms.has(chatId)) {
            socket.emit("chat:error", {
              message: "Join the chat before deleting a message",
            });
            return;
          }

          const chat = await Chat.findById(chatId);

          if (!chat) {
            socket.emit("chat:error", {
              message: "Chat not found",
            });
            return;
          }

          const isParticipant = chat.participants.some(
            (participant) => participant.toString() === userId
          );

          if (!isParticipant) {
            socket.emit("chat:error", {
              message: "You are not a participant in this chat",
            });
            return;
          }

          const acceptedExchange = await ExchangeRequest.findOne({
            _id: chat.exchangeRequest,
            status: "accepted",
          });

          if (!acceptedExchange) {
            socket.emit("chat:error", {
              message: "This exchange is not active",
            });
            return;
          }

          const message = await Message.findOne({
            _id: messageId,
            chat: chatId,
          });

          if (!message) {
            socket.emit("chat:error", {
              message: "Message not found",
            });
            return;
          }

          // Users can delete only messages they sent.
          if (message.sender.toString() !== userId) {
            socket.emit("chat:error", {
              message: "You can only delete your own messages",
            });
            return;
          }

          await Message.deleteOne({
            _id: messageId,
            chat: chatId,
            sender: userId,
          });

          // Refresh the chat preview after deletion.
          const latestMessage = await Message.findOne({
            chat: chatId,
          })
            .sort({ createdAt: -1 })
            .select("text createdAt");

          chat.lastMessage = latestMessage?.text ?? "";
          chat.lastMessageAt = latestMessage?.createdAt;
          await chat.save();

          // Remove the message from both participants' chat screens.
          io.to(chatId).emit("message:deleted", {
            chatId,
            messageId,
          });
        } catch (error) {
          console.error("Delete message error:", error);

          socket.emit("chat:error", {
            message: "Failed to delete message",
          });
        }
      }
    );

    socket.on("disconnect", () => {
      console.log(`User disconnected from chat: ${userId}`);
    });
  });
};
