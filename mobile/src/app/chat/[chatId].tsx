
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { io, Socket } from "socket.io-client";

import {
  apiRequest,
  ChatMessage,
  ChatMessagesResponse,
  ChatParticipant,
  SOCKET_BASE_URL,
} from "@/lib/api";

type SenderLike =
  | ChatParticipant
  | string
  | Record<string, unknown>
  | null
  | undefined;

const normalizeId = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    // Handle MongoDB ObjectId.
    if (typeof record.toString === "function") {
      const objectIdString = String(record);

      if (
        objectIdString &&
        objectIdString !== "[object Object]"
      ) {
        return objectIdString.trim();
      }
    }

    return normalizeId(
      record._id ??
        record.id ??
        record.userId ??
        record.senderId,
    );
  }

  return "";
};

const getSenderId = (sender: SenderLike): string => {
  if (!sender) return "";

  if (typeof sender === "string" || typeof sender === "number") {
    return normalizeId(sender);
  }

  const record = sender as Record<string, unknown>;

  return normalizeId(
    record._id ??
      record.id ??
      record.userId ??
      record.senderId ??
      record.user ??
      record.sender,
  );
};

const getMessageSenderId = (message: ChatMessage): string => {
  const record = message as unknown as Record<string, unknown>;

  return (
    getSenderId(record.sender as SenderLike) ||
    getSenderId(record.senderId as SenderLike) ||
    getSenderId(record.userId as SenderLike)
  );
};

const getSenderName = (sender: SenderLike): string => {
  if (!sender || typeof sender === "string") {
    return "SkillBridge user";
  }

  const record = sender as Record<string, unknown>;

  return typeof record.name === "string"
    ? record.name
    : "SkillBridge user";
};

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const setupChat = async () => {
      try {
        setLoading(true);

        const token = await SecureStore.getItemAsync(
          "skillbridge_token",
        );

        if (!token) {
          router.replace("/" as any);
          return;
        }

        const [messageResponse, profileResponse] = await Promise.all([
          apiRequest<ChatMessagesResponse>(
            `/chats/${chatId}/messages`,
            { token },
          ),
          apiRequest<{ user: { _id: string } }>(
            "/profile/me",
            { token },
          ),
        ]);

        if (cancelled) return;

        setMessages(messageResponse.messages ?? []);

        const profileUser =
          profileResponse.user as unknown as Record<string, unknown>;

        const profileId = normalizeId(
          profileUser._id ??
            profileUser.id ??
            profileUser.userId,
        );

        setCurrentUserId(profileId);

        const socket = io(SOCKET_BASE_URL, {
          auth: { token },
          transports: ["websocket"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("chat:join", { chatId });
        });

        socket.on(
          "chat:joined",
          (data: { chatId: string }) => {
            if (data.chatId === chatId) {
              setJoined(true);
            }
          },
        );

        socket.on(
          "message:new",
          (message: ChatMessage) => {
            if (message.chat !== chatId) return;

            setMessages((current) => {
              const alreadyExists = current.some(
                (item) => item._id === message._id,
              );

              if (alreadyExists) return current;

              return [...current, message];
            });
          },
        );

        socket.on(
          "message:edited",
          (data: { chatId: string; message: ChatMessage }) => {
            if (data.chatId !== chatId || !data.message?._id) return;

            setMessages((current) =>
              current.map((item) =>
                item._id === data.message._id ? data.message : item,
              ),
            );

            setEditingMessage((current) =>
              current?._id === data.message._id ? null : current,
            );
          },
        );

        socket.on(
          "message:deleted",
          (data: {
            chatId: string;
            messageId: string;
          }) => {
            if (data.chatId !== chatId) return;

            setMessages((current) =>
              current.filter(
                (message) => message._id !== data.messageId,
              ),
            );
          },
        );

        socket.on(
          "chat:error",
          (data: { message?: string }) => {
            Alert.alert(
              "Chat error",
              data?.message ?? "Something went wrong.",
            );
          },
        );

        socket.on("connect_error", (error) => {
          Alert.alert(
            "Connection failed",
            error.message,
          );
        });
      } catch (error) {
        Alert.alert(
          "Could not open chat",
          error instanceof Error
            ? error.message
            : "Please try again.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setupChat();

    return () => {
      cancelled = true;
      setJoined(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [chatId]);

  const sendMessage = () => {
    const text = messageText.trim();

    if (!text) return;

    if (!socketRef.current?.connected || !joined) {
      Alert.alert(
        "Not connected",
        "Please wait until the chat is connected.",
      );
      return;
    }

    if (text.length > 2000) {
      Alert.alert(
        "Message too long",
        "Messages cannot exceed 2000 characters.",
      );
      return;
    }

    if (editingMessage) {
      const createdAt = new Date(editingMessage.createdAt).getTime();
      const withinEditWindow =
        Number.isFinite(createdAt) &&
        Date.now() - createdAt >= 0 &&
        Date.now() - createdAt <= 5 * 60 * 1000;

      if (!withinEditWindow) {
        Alert.alert(
          "Edit time expired",
          "Messages can only be edited within 5 minutes of sending.",
        );
        setEditingMessage(null);
        setMessageText("");
        return;
      }

      if (text === editingMessage.text.trim()) {
        setEditingMessage(null);
        setMessageText("");
        return;
      }

      socketRef.current.emit("message:edit", {
        chatId,
        messageId: editingMessage._id,
        text,
      });

      // Wait for the server's message:edited event to update the message.
      setMessageText("");
      setEditingMessage(null);
      return;
    }

    socketRef.current.emit("message:send", {
      chatId,
      text,
    });

    setMessageText("");
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setMessageText("");
  };

  const confirmDeleteMessage = (message: ChatMessage) => {
    const senderId = getMessageSenderId(message);
    const isMine =
      Boolean(senderId) &&
      Boolean(currentUserId) &&
      senderId === normalizeId(currentUserId);

    if (!isMine) {
      Alert.alert(
        "Cannot manage message",
        "You can only edit or delete messages that you sent.",
      );
      return;
    }

    const createdAt = new Date(message.createdAt).getTime();
    const withinEditWindow =
      Number.isFinite(createdAt) &&
      Date.now() - createdAt >= 0 &&
      Date.now() - createdAt <= 5 * 60 * 1000;

    const options: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[] = [];

    if (withinEditWindow) {
      options.push({
        text: "Edit message",
        onPress: () => {
          setEditingMessage(message);
          setMessageText(message.text);
        },
      });
    }

    options.push({
      text: "Delete message",
      style: "destructive",
      onPress: () => {
        Alert.alert(
          "Delete message?",
          "This message will be deleted for both participants.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                if (!socketRef.current?.connected || !joined) {
                  Alert.alert(
                    "Not connected",
                    "Please wait until the chat is connected.",
                  );
                  return;
                }

                socketRef.current.emit("message:delete", {
                  chatId,
                  messageId: message._id,
                });
              },
            },
          ],
        );
      },
    });

    options.push({ text: "Cancel", style: "cancel" });

    Alert.alert(
      "Message options",
      withinEditWindow
        ? "You can edit this message within 5 minutes of sending."
        : "The 5-minute edit window has expired.",
      options,
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            SkillBridge Chat
          </Text>

          <Text style={styles.connectionText}>
            {joined ? "Connected" : "Connecting..."}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Loading messages...
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({
                animated: true,
              })
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyTitle}>
                  Start the conversation
                </Text>

                <Text style={styles.emptyText}>
                  Say hello to your skill exchange partner!
                </Text>
              </View>
            ) : (
              messages.map((message) => {
                const messageSenderId =
                  getMessageSenderId(message);

                const isMine =
                  Boolean(messageSenderId) &&
                  messageSenderId ===
                    normalizeId(currentUserId);

                return (
                  <View
                    key={message._id}
                    style={[
                      styles.messageRow,
                      isMine && styles.myMessageRow,
                    ]}
                  >
                    <Pressable
                      delayLongPress={500}
                      onPress={() => {}}
                      onLongPress={() => {
                        confirmDeleteMessage(message);
                      }}
                      style={[
                        styles.messageBubble,
                        isMine
                          ? styles.myMessageBubble
                          : styles.theirMessageBubble,
                      ]}
                    >
                      {!isMine && (
                        <Text style={styles.senderName}>
                          {getSenderName(message.sender)}
                        </Text>
                      )}

                      <Text
                        style={[
                          styles.messageText,
                          isMine && styles.myMessageText,
                        ]}
                      >
                        {message.text}
                      </Text>

                      <Text
                        style={[
                          styles.messageTime,
                          isMine && styles.myMessageTime,
                        ]}
                      >
                        {new Date(
                          message.createdAt,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>

                      {(message as ChatMessage & { editedAt?: string }).editedAt && (
                        <Text
                          style={[
                            styles.messageTime,
                            isMine && styles.myMessageTime,
                          ]}
                        >
                          Edited
                        </Text>
                      )}

                      {isMine && (
                        <Text style={styles.deleteHint}>
                          Hold to edit or delete
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder={editingMessage ? "Edit your message..." : "Write a message..."}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
              textAlignVertical="center"
              style={styles.messageInput}
            />

            {editingMessage && (
              <Pressable
                style={styles.cancelEditButton}
                onPress={cancelEditing}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </Pressable>
            )}

            {messageText.trim().length > 0 && (
              <Pressable
                style={[
                  styles.sendButton,
                  !joined && styles.disabledSendButton,
                ]}
                disabled={!joined}
                onPress={sendMessage}
              >
                <Text style={styles.sendButtonText}>
                  {editingMessage ? "Save" : "➤"}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  backText: {
    fontSize: 32,
    color: "#111827",
    lineHeight: 36,
  },
  headerInfo: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  connectionText: {
    marginTop: 3,
    fontSize: 12,
    color: "#16A34A",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "82%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
  },
  theirMessageBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderBottomLeftRadius: 4,
  },
  myMessageBubble: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#111827",
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  messageTime: {
    marginTop: 5,
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "right",
  },
  myMessageTime: {
    color: "#DBEAFE",
  },
  deleteHint: {
    marginTop: 3,
    fontSize: 9,
    color: "#DBEAFE",
    textAlign: "right",
  },
  cancelEditButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  cancelEditText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom:
      Platform.OS === "android" ? 10 : 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 10,
  },
  messageInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    color: "#111827",
    fontSize: 16,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  disabledSendButton: {
    backgroundColor: "#9CA3AF",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
