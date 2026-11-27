
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

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

        if (typeof chatId !== "string") {
          socket.emit("chat:error", {
            message: "Chat ID is required",
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
            typeof text !== "string" ||
            !text
          ) {
            socket.emit("chat:error", {
              message: "Chat ID and message text are required",
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

    socket.on("disconnect", () => {
      console.log(`User disconnected from chat: ${userId}`);
    });
  });
};
