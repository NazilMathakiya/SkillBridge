
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

const getSenderId = (sender: ChatParticipant | string): string => {
  if (typeof sender === "string") {
    return sender;
  }

  return String(sender._id ?? "");
};

const getSenderName = (sender: ChatParticipant | string): string => {
  if (typeof sender === "string") {
    return "SkillBridge user";
  }

  return sender.name ?? "SkillBridge user";
};

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const setupChat = async () => {
      try {
        setLoading(true);

        const token = await SecureStore.getItemAsync("skillbridge_token");

        if (!token) {
          router.replace("/" as any);
          return;
        }

        const [messageResponse, profileResponse] = await Promise.all([
          apiRequest<ChatMessagesResponse>(`/chats/${chatId}/messages`, {
            token,
          }),
          apiRequest<{ user: { _id: string } }>("/profile/me", { token }),
        ]);

        if (cancelled) return;

        setMessages(messageResponse.messages ?? []);
        setCurrentUserId(String(profileResponse.user._id));

        const socket = io(SOCKET_BASE_URL, {
          auth: { token },
          transports: ["websocket"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("chat:join", { chatId });
        });

        socket.on("chat:joined", (data: { chatId: string }) => {
          if (data.chatId === chatId) {
            setJoined(true);
          }
        });

        socket.on("message:new", (message: ChatMessage) => {
          if (message.chat !== chatId) return;

          setMessages((current) => {
            const alreadyExists = current.some(
              (item) => item._id === message._id,
            );

            if (alreadyExists) return current;

            return [...current, message];
          });
        });

        socket.on(
          "message:deleted",
          (data: { chatId: string; messageId: string }) => {
            if (data.chatId !== chatId) return;

            setMessages((current) =>
              current.filter((message) => message._id !== data.messageId),
            );
          },
        );

        socket.on("chat:error", (data: { message?: string }) => {
          Alert.alert(
            "Chat error",
            data?.message ?? "Something went wrong.",
          );
        });

        socket.on("connect_error", (error) => {
          Alert.alert("Connection failed", error.message);
        });
      } catch (error) {
        Alert.alert(
          "Could not open chat",
          error instanceof Error ? error.message : "Please try again.",
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

    socketRef.current.emit("message:send", {
      chatId,
      text,
    });

    setMessageText("");
  };

  const confirmDeleteMessage = (message: ChatMessage) => {
    const senderId = getSenderId(message.sender);
    const isMine = senderId === currentUserId;

    console.log("Long press message:", {
      messageId: message._id,
      senderId,
      currentUserId,
      isMine,
    });

    if (!isMine) {
      Alert.alert(
        "Cannot delete message",
        "You can only delete messages that you sent.",
      );
      return;
    }

    Alert.alert(
      "Delete message?",
      "This message will be deleted for both participants.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
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
          <Text style={styles.headerTitle}>SkillBridge Chat</Text>
          <Text style={styles.connectionText}>
            {joined ? "Connected" : "Connecting..."}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  Say hello to your skill exchange partner!
                </Text>
              </View>
            ) : (
              messages.map((message) => {
                const isMine =
                  getSenderId(message.sender) === currentUserId;

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
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>

                      {isMine && (
                        <Text style={styles.deleteHint}>
                          Hold to delete
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
              placeholder="Write a message..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
              textAlignVertical="center"
              style={styles.messageInput}
            />

            {messageText.trim().length > 0 && (
              <Pressable
                style={[
                  styles.sendButton,
                  !joined && styles.disabledSendButton,
                ]}
                disabled={!joined}
                onPress={sendMessage}
              >
                <Text style={styles.sendButtonText}>➤</Text>
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "android" ? 10 : 12,
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
