
import { Expo } from "expo-server-sdk";

const expo = new Expo();

interface PushNotificationInput {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async ({
  tokens,
  title,
  body,
  data = {},
}: PushNotificationInput): Promise<void> => {
  try {
    // Remove duplicate tokens and keep only valid Expo tokens.
    const uniqueTokens = [...new Set(tokens)];

    const validTokens = uniqueTokens.filter((token) =>
      Expo.isExpoPushToken(token)
    );

    if (validTokens.length === 0) {
      console.log("No valid Expo push tokens found.");
      return;
    }

    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default" as const,
      title,
      body,
      data,
    }));

    // Expo requires notifications to be sent in chunks.
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      console.log("Expo push notification tickets:", tickets);
    }
  } catch (error) {
    console.error("Push notification error:", error);
  }
};
