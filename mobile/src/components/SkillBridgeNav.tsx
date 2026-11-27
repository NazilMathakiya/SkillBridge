
import React from "react";
import { router, usePathname } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const tabs = [
  { label: "Explore", route: "/explore" },
  { label: "Requests", route: "/requests" },
  { label: "Chats", route: "/chats" },
  { label: "Profile", route: "/profile" },
] as const;

export default function SkillBridgeNav() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active =
          pathname === tab.route ||
          (tab.route === "/chats" && pathname.startsWith("/chat/"));

        return (
          <Pressable
            key={tab.route}
            style={[
              styles.tab,
              active && styles.activeTab,
            ]}
            onPress={() => router.push(tab.route as any)}
          >
            <Text
              style={[
                styles.label,
                active && styles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: "#EDE9FE",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeLabel: {
    color: "#6D28D9",
  },
});
