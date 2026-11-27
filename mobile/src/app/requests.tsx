import React, { useCallback, useState } from "react";
import SkillBridgeNav from "../components/SkillBridgeNav";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { apiRequest } from "@/lib/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

type Session = {
  _id: string;
  exchangeRequest: string;
  sender: UserInfo | string;
  receiver: UserInfo | string;
  proposedBy: UserInfo | string;
  scheduledAt: string;
  durationMinutes: number;
  mode: "online" | "in_person";
  meetingDetails: string;
  status:
    | "proposed"
    | "confirmed"
    | "reschedule_requested"
    | "cancelled";
};

type RequestsResponse = {
  success: boolean;
  count: number;
  requests: ExchangeRequest[];
};

type SessionsResponse = {
  success: boolean;
  count: number;
  sessions: Session[];
};

type Tab = "received" | "sent";

const getUserName = (user?: UserInfo | string) => {
  if (!user) return "Unknown user";
  if (typeof user === "string") return "SkillBridge user";
  return user.name || "SkillBridge user";
};

const getUserId = (user?: UserInfo | string) => {
  if (!user) return "";
  if (typeof user === "string") return user;
  return user._id;
};

/**
 * Keeps one local reminder per confirmed session on this device.
 * The reminder fires 30 minutes before the session starts.
 * Proposed/reschedule-requested/cancelled sessions have no reminder.
 */
const syncSessionReminders = async (sessions: Session[]) => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter(
    (notification) =>
      notification.content.data?.skillBridgeSessionReminder === true
  );

  const now = Date.now();
  const targetSessions = sessions
    .filter((session) => session.status === "confirmed")
    .map((session) => {
      const sessionDate = new Date(session.scheduledAt);
      const reminderDate = new Date(sessionDate.getTime() - 30 * 60 * 1000);
      return { session, sessionDate, reminderDate };
    })
    .filter(
      ({ sessionDate, reminderDate }) =>
        !Number.isNaN(sessionDate.getTime()) &&
        sessionDate.getTime() > now &&
        reminderDate.getTime() > now
    );

  const targetById = new Map(
    targetSessions.map(({ session, sessionDate }) => [
      session._id,
      sessionDate.toISOString(),
    ])
  );

  // Cancel reminders for cancelled, changed, or no-longer-confirmed sessions.
  for (const notification of existing) {
    const sessionId = notification.content.data?.sessionId;
    const storedSchedule = notification.content.data?.scheduledAt;
    const currentSchedule =
      typeof sessionId === "string" ? targetById.get(sessionId) : undefined;

    if (!currentSchedule || currentSchedule !== storedSchedule) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }

  if (targetSessions.length === 0) return;

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return;

  const remaining = await Notifications.getAllScheduledNotificationsAsync();
  const existingForSessions = new Map(
    remaining
      .filter(
        (notification) =>
          notification.content.data?.skillBridgeSessionReminder === true
      )
      .map((notification) => [
        String(notification.content.data?.sessionId ?? ""),
        String(notification.content.data?.scheduledAt ?? ""),
      ])
  );

  for (const { session, sessionDate, reminderDate } of targetSessions) {
    if (existingForSessions.get(session._id) === sessionDate.toISOString()) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "SkillBridge session soon",
        body: `Your session starts in 30 minutes (${sessionDate.toLocaleString()}).`,
        sound: "default",
        data: {
          skillBridgeSessionReminder: true,
          sessionId: session._id,
          scheduledAt: sessionDate.toISOString(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  }
};

export default function RequestsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("received");

  const [receivedRequests, setReceivedRequests] = useState<
    ExchangeRequest[]
  >([]);
  const [sentRequests, setSentRequests] = useState<ExchangeRequest[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );

  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [mode, setMode] = useState<"online" | "in_person">("online");
  const [meetingDetails, setMeetingDetails] = useState("");

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

      const [received, sent, sessionResponse, profile] =
        await Promise.all([
          apiRequest<RequestsResponse>(
            "/exchange-requests/received",
            { token }
          ),
          apiRequest<RequestsResponse>(
            "/exchange-requests/sent",
            { token }
          ),
          apiRequest<SessionsResponse>("/sessions", { token }),
          apiRequest<{ user: UserInfo }>("/profile/me", { token }),
        ]);

      setReceivedRequests(received.requests ?? []);
      setSentRequests(sent.requests ?? []);
      const loadedSessions = sessionResponse.sessions ?? [];
      setSessions(loadedSessions);
      setCurrentUserId(profile.user._id);

      // Reminder scheduling is best-effort; it must not block request loading.
      try {
        await syncSessionReminders(loadedSessions);
      } catch (notificationError) {
        console.warn("Could not sync session reminders:", notificationError);
      }
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

  const getSessionForRequest = (requestId: string) => {
    return sessions.find(
      (session) => getUserId(session.exchangeRequest) === requestId
    );
  };

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

      await apiRequest(
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

  const openScheduleForm = (
    request: ExchangeRequest,
    session?: Session
  ) => {
    setSelectedRequestId(request._id);
    setSelectedSessionId(session?._id ?? null);

    setSelectedDateTime(
      session?.scheduledAt
        ? new Date(session.scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000)
    );
    setShowDatePicker(false);
    setShowTimePicker(false);

    setDurationMinutes(
      session ? String(session.durationMinutes) : "60"
    );

    setMode(session?.mode ?? "online");
    setMeetingDetails(session?.meetingDetails ?? "");
  };

  const closeScheduleForm = () => {
    setSelectedRequestId(null);
    setSelectedSessionId(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const saveSchedule = async () => {
    if (!selectedRequestId) return;

    const date = selectedDateTime;
    const duration = Number(durationMinutes);

    if (Number.isNaN(date.getTime())) {
      Alert.alert(
        "Invalid date/time",
        "Please select a valid date and time."
      );
      return;
    }

    if (
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 240
    ) {
      Alert.alert(
        "Invalid duration",
        "Duration must be between 15 and 240 minutes."
      );
      return;
    }

    if (date.getTime() <= Date.now()) {
      Alert.alert(
        "Choose a future time",
        "The session date and time must be in the future."
      );
      return;
    }

    try {
      setActionId(selectedSessionId ?? selectedRequestId);

      const token = await SecureStore.getItemAsync("skillbridge_token");

      if (!token) {
        router.replace("/" as any);
        return;
      }

      const body = {
        scheduledAt: date.toISOString(),
        durationMinutes: duration,
        mode,
        meetingDetails: meetingDetails.trim(),
      };

      if (selectedSessionId) {
        await apiRequest(
          `/sessions/${selectedSessionId}/reschedule`,
          {
            method: "PATCH",
            token,
            body,
          }
        );

        Alert.alert(
          "Reschedule proposed",
          "The other participant needs to confirm the new time."
        );
      } else {
        await apiRequest(
          "/sessions",
          {
            method: "POST",
            token,
            body: {
              ...body,
              exchangeRequestId: selectedRequestId,
            },
          }
        );

        Alert.alert(
          "Session proposed",
          "Your session proposal has been sent."
        );
      }

      closeScheduleForm();
      await loadRequests(true);
    } catch (error) {
      Alert.alert(
        "Could not save session",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setActionId(null);
    }
  };

  const confirmSession = async (sessionId: string) => {
    try {
      setActionId(sessionId);

      const token = await SecureStore.getItemAsync("skillbridge_token");

      if (!token) {
        router.replace("/" as any);
        return;
      }

      await apiRequest(
        `/sessions/${sessionId}/confirm`,
        {
          method: "PATCH",
          token,
        }
      );

      await loadRequests(true);

      Alert.alert("Session confirmed", "Your session is confirmed.");
    } catch (error) {
      Alert.alert(
        "Could not confirm",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setActionId(null);
    }
  };

  const cancelSession = (sessionId: string) => {
    Alert.alert(
      "Cancel session?",
      "The scheduled session will be cancelled.",
      [
        { text: "Keep session", style: "cancel" },
        {
          text: "Cancel session",
          style: "destructive",
          onPress: async () => {
            try {
              setActionId(sessionId);

              const token =
                await SecureStore.getItemAsync("skillbridge_token");

              if (!token) {
                router.replace("/" as any);
                return;
              }

              await apiRequest(
                `/sessions/${sessionId}/cancel`,
                {
                  method: "PATCH",
                  token,
                }
              );

              await loadRequests(true);
            } catch (error) {
              Alert.alert(
                "Could not cancel",
                error instanceof Error
                  ? error.message
                  : "Please try again."
              );
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
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
              const session = getSessionForRequest(request._id);

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

                  {request.status === "accepted" && !session && (
                    <Pressable
                      style={styles.scheduleButton}
                      onPress={() => openScheduleForm(request)}
                    >
                      <Text style={styles.scheduleButtonText}>
                        Schedule Session
                      </Text>
                    </Pressable>
                  )}

                  {session && (
                    <View style={styles.sessionBox}>
                      <Text style={styles.sessionTitle}>
                        Session Details
                      </Text>

                      <Text style={styles.sessionText}>
                        Date: {new Date(session.scheduledAt).toLocaleString()}
                      </Text>

                      <Text style={styles.sessionText}>
                        Duration: {session.durationMinutes} minutes
                      </Text>

                      <Text style={styles.sessionText}>
                        Type: {session.mode === "online" ? "Online" : "In person"}
                      </Text>

                      <Text style={styles.sessionText}>
                        Status: {session.status.replace("_", " ")}
                      </Text>

                      {!!session.meetingDetails && (
                        <Text style={styles.sessionText}>
                          Details: {session.meetingDetails}
                        </Text>
                      )}

                      {session.status === "proposed" ||
                      session.status === "reschedule_requested" ? (
                        getUserId(session.proposedBy) !== currentUserId ? (
                          <Pressable
                            disabled={actionId === session._id}
                            style={styles.confirmButton}
                            onPress={() => confirmSession(session._id)}
                          >
                            <Text style={styles.confirmButtonText}>
                              Confirm Session
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.waitingText}>
                            Waiting for the other participant to confirm
                          </Text>
                        )
                      ) : null}

                      {session.status !== "cancelled" && (
                        <View style={styles.actions}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              styles.rescheduleButton,
                            ]}
                            onPress={() =>
                              openScheduleForm(request, session)
                            }
                          >
                            <Text style={styles.rescheduleText}>
                              Reschedule
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.actionButton,
                              styles.rejectButton,
                            ]}
                            onPress={() => cancelSession(session._id)}
                          >
                            <Text style={styles.rejectText}>
                              Cancel
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}

                  {selectedRequestId === request._id && (
                    <View style={styles.scheduleForm}>
                      <Text style={styles.formTitle}>
                        {selectedSessionId
                          ? "Propose New Schedule"
                          : "Schedule Session"}
                      </Text>

                      <Text style={styles.inputLabel}>
                        Date and time
                      </Text>

                      <Pressable
                        style={styles.dateTimeButton}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={styles.dateTimeButtonText}>
                          📅 {selectedDateTime.toLocaleDateString([], {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          })}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Text style={styles.dateTimeButtonText}>
                          🕒 {selectedDateTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Pressable>

                      {showDatePicker && (
                        <DateTimePicker
                          value={selectedDateTime}
                          mode="date"
                          display="default"
                          minimumDate={new Date()}
                          onChange={(event, date) => {
                            setShowDatePicker(false);
                            if (date) {
                              setSelectedDateTime((current) => {
                                const updated = new Date(current);
                                updated.setFullYear(
                                  date.getFullYear(),
                                  date.getMonth(),
                                  date.getDate()
                                );
                                return updated;
                              });
                            }
                          }}
                        />
                      )}

                      {showTimePicker && (
                        <DateTimePicker
                          value={selectedDateTime}
                          mode="time"
                          display="default"
                          onChange={(event, date) => {
                            setShowTimePicker(false);
                            if (date) {
                              setSelectedDateTime((current) => {
                                const updated = new Date(current);
                                updated.setHours(
                                  date.getHours(),
                                  date.getMinutes(),
                                  0,
                                  0
                                );
                                return updated;
                              });
                            }
                          }}
                        />
                      )}

                      <Text style={styles.inputHint}>
                        Select a date from the calendar and a time from the clock.
                      </Text>

                      <Text style={styles.inputLabel}>
                        Duration (minutes)
                      </Text>

                      <TextInput
                        value={durationMinutes}
                        onChangeText={setDurationMinutes}
                        keyboardType="number-pad"
                        placeholder="60"
                        style={styles.input}
                      />

                      <Text style={styles.inputLabel}>
                        Session type
                      </Text>

                      <View style={styles.modeRow}>
                        <Pressable
                          style={[
                            styles.modeButton,
                            mode === "online" && styles.modeSelected,
                          ]}
                          onPress={() => setMode("online")}
                        >
                          <Text
                            style={[
                              styles.modeText,
                              mode === "online" && styles.modeSelectedText,
                            ]}
                          >
                            Online
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.modeButton,
                            mode === "in_person" && styles.modeSelected,
                          ]}
                          onPress={() => setMode("in_person")}
                        >
                          <Text
                            style={[
                              styles.modeText,
                              mode === "in_person" && styles.modeSelectedText,
                            ]}
                          >
                            In person
                          </Text>
                        </Pressable>
                      </View>

                      <Text style={styles.inputLabel}>
                        Meeting details (optional)
                      </Text>

                      <TextInput
                        value={meetingDetails}
                        onChangeText={setMeetingDetails}
                        placeholder="Meeting link or location"
                        multiline
                        style={[styles.input, styles.multilineInput]}
                      />

                      <View style={styles.actions}>
                        <Pressable
                          style={[
                            styles.actionButton,
                            styles.rejectButton,
                          ]}
                          onPress={closeScheduleForm}
                        >
                          <Text style={styles.rejectText}>Close</Text>
                        </Pressable>

                        <Pressable
                          disabled={actionId !== null}
                          style={[
                            styles.actionButton,
                            styles.acceptButton,
                          ]}
                          onPress={saveSchedule}
                        >
                          {actionId !== null ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.acceptText}>
                              Send Proposal
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
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
  scheduleButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  scheduleButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sessionBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1D4ED8",
    marginBottom: 8,
  },
  sessionText: {
    fontSize: 13,
    color: "#374151",
    marginTop: 4,
  },
  confirmButton: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: "#16A34A",
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  waitingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B7280",
  },
  rescheduleButton: {
    backgroundColor: "#DBEAFE",
  },
  rescheduleText: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  scheduleForm: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
  },
  dateTimeButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 9,
  },
  dateTimeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  inputHint: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 5,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: "#E5E7EB",
  },
  modeSelected: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  modeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  modeSelectedText: {
    color: "#1D4ED8",
  },
});