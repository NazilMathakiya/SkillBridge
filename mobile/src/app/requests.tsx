
import React, { useCallback, useState } from "react";
import SkillBridgeNav from "../components/SkillBridgeNav";
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
import { apiRequest } from "@/lib/api";

type UserInfo = {
  _id: string;
  name: string;
  email?: string;
};

type ExchangeRequest = {
  _id: string;
  sender?: UserInfo | string;
  receiver?: UserInfo | string;
  offeredSkill: string;
  wantedSkill: string;
  status: "pending" | "accepted" | "rejected";
  createdAt?: string;
};

type RequestsResponse = {
  success: boolean;
  count: number;
  requests: ExchangeRequest[];
};

type RespondResponse = {
  success: boolean;
  message?: string;
};

type Tab = "received" | "sent";

export default function RequestsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("received");
  const [receivedRequests, setReceivedRequests] = useState<
    ExchangeRequest[]
  >([]);
  const [sentRequests, setSentRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await SecureStore.getItemAsync("skillbridge_token");

      if (!token) {
        router.replace("/" as any);
        return;
      }

      const [received, sent] = await Promise.all([
        apiRequest<RequestsResponse>(
          "/exchange-requests/received",
          { token }
        ),
        apiRequest<RequestsResponse>(
          "/exchange-requests/sent",
          { token }
        ),
      ]);

      setReceivedRequests(received.requests ?? []);
      setSentRequests(sent.requests ?? []);
    } catch (error) {
      Alert.alert(
        "Could not load requests",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const respondToRequest = async (
    requestId: string,
    status: "accepted" | "rejected"
  ) => {
    try {
      setActionId(requestId);

      const token = await SecureStore.getItemAsync("skillbridge_token");

      if (!token) {
        router.replace("/" as any);
        return;
      }

      await apiRequest<RespondResponse>(
        `/exchange-requests/${requestId}/respond`,
        {
          method: "PATCH",
          token,
          body: { status },
        }
      );

      await loadRequests(true);

      Alert.alert(
        "Request updated",
        status === "accepted"
          ? "You accepted the exchange request."
          : "You rejected the exchange request."
      );
    } catch (error) {
      Alert.alert(
        "Action failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setActionId(null);
    }
  };

  const getUserName = (user?: UserInfo | string) => {
    if (!user) return "Unknown user";
    if (typeof user === "string") return "SkillBridge user";
    return user.name || "SkillBridge user";
  };

  const requests =
    activeTab === "received" ? receivedRequests : sentRequests;

  const pendingReceived = receivedRequests.filter(
    (request) => request.status === "pending"
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exchange Requests</Text>
        <Text style={styles.subtitle}>
          Manage your skill exchange connections
        </Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "received" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("received")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "received" && styles.activeTabText,
            ]}
          >
            Received {pendingReceived > 0 ? `(${pendingReceived})` : ""}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            activeTab === "sent" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("sent")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "sent" && styles.activeTabText,
            ]}
          >
            Sent
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRequests(true)}
            />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptyText}>
                {activeTab === "received"
                  ? "When someone sends you an exchange request, it will appear here."
                  : "Requests you send to other users will appear here."}
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
            requests.map((request) => {
              const person =
                activeTab === "received"
                  ? request.sender
                  : request.receiver;

              const isPending = request.status === "pending";
              const isWorking = actionId === request._id;

              const firstSkillLabel =
                activeTab === "received"
                  ? "They teach:"
                  : "You teach:";

              const secondSkillLabel =
                activeTab === "received"
                  ? "You teach:"
                  : "They teach:";

              return (
                <View key={request._id} style={styles.requestCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {getUserName(person).charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>
                        {getUserName(person)}
                      </Text>
                      <Text style={styles.requestLabel}>
                        {activeTab === "received"
                          ? "Sent you a request"
                          : "You sent a request"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        request.status === "accepted" &&
                          styles.acceptedBadge,
                        request.status === "rejected" &&
                          styles.rejectedBadge,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.skillsBox}>
                    <Text style={styles.skillLabel}>
                      Exchange details
                    </Text>

                    <Text style={styles.skillText}>
                      <Text style={styles.skillBold}>
                        {firstSkillLabel}
                      </Text>{" "}
                      {request.offeredSkill}
                    </Text>

                    <Text style={styles.skillText}>
                      <Text style={styles.skillBold}>
                        {secondSkillLabel}
                      </Text>{" "}
                      {request.wantedSkill}
                    </Text>
                  </View>

                  {activeTab === "received" && isPending && (
                    <View style={styles.actions}>
                      <Pressable
                        disabled={isWorking}
                        style={[
                          styles.actionButton,
                          styles.rejectButton,
                        ]}
                        onPress={() =>
                          respondToRequest(request._id, "rejected")
                        }
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </Pressable>

                      <Pressable
                        disabled={isWorking}
                        style={[
                          styles.actionButton,
                          styles.acceptButton,
                        ]}
                        onPress={() =>
                          respondToRequest(request._id, "accepted")
                        }
                      >
                        {isWorking ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.acceptText}>
                            Accept
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Bottom navigation */}
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
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#E8ECF4",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 14,
  },
  activeTabText: {
    color: "#2563EB",
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
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
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1D4ED8",
    fontSize: 18,
    fontWeight: "700",
  },
  personInfo: {
    flex: 1,
    marginLeft: 12,
  },
  personName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  requestLabel: {
    marginTop: 3,
    fontSize: 12,
    color: "#6B7280",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
  },
  acceptedBadge: {
    backgroundColor: "#DCFCE7",
  },
  rejectedBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
    color: "#374151",
  },
  skillsBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  skillLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    fontWeight: "600",
  },
  skillText: {
    fontSize: 14,
    color: "#374151",
    marginTop: 4,
  },
  skillBold: {
    fontWeight: "700",
    color: "#111827",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectButton: {
    backgroundColor: "#FEE2E2",
  },
  rejectText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  acceptButton: {
    backgroundColor: "#2563EB",
  },
  acceptText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
