
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import SkillBridgeNav from "../components/SkillBridgeNav";
import {
  apiRequest,
  ChatItem,
  ChatsResponse,
  ChatParticipant,
  ChatExchange,
} from "@/lib/api";

const getId = (value?: ChatParticipant | string) => {
  if (!value) return "";
  return typeof value === "string" ? value : value._id;
};

const getName = (value?: ChatParticipant | string) => {
  if (!value) return "SkillBridge user";
  return typeof value === "string" ? "SkillBridge user" : value.name;
};

export default function ChatsScreen() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await SecureStore.getItemAsync("skillbridge_token");

      if (!token) {
        router.replace("/" as any);
        return;
      }

      const [chatResponse, profileResponse] = await Promise.all([
        apiRequest<ChatsResponse>("/chats", { token }),
        apiRequest<{ user: { _id: string } }>("/profile/me", { token }),
      ]);

      setChats(chatResponse.chats ?? []);
      setCurrentUserId(profileResponse.user._id);
    } catch (error) {
      Alert.alert(
        "Could not load chats",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  const openChat = (chat: ChatItem) => {
    router.push({
      pathname: "/chat/[chatId]",
      params: { chatId: chat._id },
    } as any);
  };

  const getOtherParticipant = (chat: ChatItem) => {
    const exchange = chat.exchangeRequest;

    if (typeof exchange === "string") {
      return "SkillBridge user";
    }

    const senderId = getId(exchange.sender);
    const other =
      senderId === currentUserId
        ? exchange.receiver
        : exchange.sender;

    return getName(other);
  };

  const getExchangeDetails = (chat: ChatItem) => {
    const exchange = chat.exchangeRequest;

    if (typeof exchange === "string") {
      return "Accepted skill exchange";
    }

    return `${exchange.offeredSkill} ↔ ${exchange.wantedSkill}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>
          Message your accepted exchange partners
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadChats(true)}
            />
          }
        >
          {chats.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptyText}>
                Once an exchange request is accepted, your chat with that
                person will appear here.
              </Text>
              <Pressable
                style={styles.exploreButton}
                onPress={() => router.push("/explore" as any)}
              >
                <Text style={styles.exploreButtonText}>
                  Explore Skills
                </Text>
              </Pressable>
            </View>
          ) : (
            chats.map((chat) => (
              <Pressable
                key={chat._id}
                style={styles.chatCard}
                onPress={() => openChat(chat)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getOtherParticipant(chat).charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.chatInfo}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {getOtherParticipant(chat)}
                  </Text>

                  <Text style={styles.exchangeText} numberOfLines={1}>
                    {getExchangeDetails(chat)}
                  </Text>

                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {chat.lastMessage || "Start your conversation"}
                  </Text>
                </View>

                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <SkillBridgeNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
    flexGrow: 1,
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
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  exploreButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  exploreButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1D4ED8",
    fontSize: 18,
    fontWeight: "700",
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  exchangeText: {
    marginTop: 3,
    fontSize: 12,
    color: "#2563EB",
  },
  lastMessage: {
    marginTop: 5,
    fontSize: 13,
    color: "#6B7280",
  },
  arrow: {
    marginLeft: 8,
    fontSize: 28,
    color: "#9CA3AF",
  },
});
