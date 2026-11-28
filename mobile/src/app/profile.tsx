import { useCallback, useEffect, useState } from "react";
import SkillBridgeNav from "../components/SkillBridgeNav";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import {
  getMyProfile,
  updateMyProfile,
} from "../lib/api";

const TOKEN_KEY = "skillbridge_token";

const COLORS = {
  navy: "#172B4D",
  navyLight: "#243B60",
  background: "#F5F6F2",
  white: "#FFFFFF",
  sage: "#789985",
  sageLight: "#E8EFE9",
  text: "#172B4D",
  secondary: "#718096",
  border: "#E1E6E0",
  danger: "#B94A48",
  success: "#427A5B",
};

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [skillsToTeach, setSkillsToTeach] = useState<string[]>([]);
  const [skillsToLearn, setSkillsToLearn] = useState<string[]>([]);

  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Define the callback before the effect that uses it.
  const loadProfile = useCallback(async (): Promise<void> => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await getMyProfile(token);

      setName(response.user.name ?? "");
      setBio(response.user.bio ?? "");
      setSkillsToTeach(response.user.skillsToTeach ?? []);
      setSkillsToLearn(response.user.skillsToLearn ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function addSkill(
    value: string,
    currentSkills: string[],
    setSkills: (skills: string[]) => void,
    clearInput: () => void,
  ) {
    const skill = value.trim().toLowerCase();

    if (!skill) {
      return;
    }

    const alreadyExists = currentSkills.some(
      (item) => item.toLowerCase() === skill,
    );

    if (!alreadyExists) {
      setSkills([...currentSkills, skill]);
    }

    clearInput();
    Keyboard.dismiss();
  }

  function removeSkill(
    skillToRemove: string,
    currentSkills: string[],
    setSkills: (skills: string[]) => void,
  ) {
    setSkills(
      currentSkills.filter((skill) => skill !== skillToRemove),
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await updateMyProfile(token, {
        name: name.trim(),
        bio: bio.trim(),
        skillsToTeach,
        skillsToLearn,
      });

      setName(response.user.name ?? "");
      setBio(response.user.bio ?? "");
      setSkillsToTeach(response.user.skillsToTeach ?? []);
      setSkillsToLearn(response.user.skillsToLearn ?? []);

      setSuccessMessage("Your profile has been saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderSkillSection(
    title: string,
    subtitle: string,
    skills: string[],
    inputValue: string,
    setInputValue: (value: string) => void,
    setSkills: (skills: string[]) => void,
  ) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>

        <View style={styles.addSkillRow}>
          <TextInput
            style={styles.skillInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Enter a skill"
            placeholderTextColor={COLORS.secondary}
            returnKeyType="done"
            onSubmitEditing={() =>
              addSkill(
                inputValue,
                skills,
                setSkills,
                () => setInputValue(""),
              )
            }
          />

          <Pressable
            style={styles.addButton}
            onPress={() =>
              addSkill(
                inputValue,
                skills,
                setSkills,
                () => setInputValue(""),
              )
            }
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {skills.length > 0 ? (
          <View style={styles.skillList}>
            {skills.map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillText}>{skill}</Text>

                <Pressable
                  onPress={() =>
                    removeSkill(skill, skills, setSkills)
                  }
                  hitSlop={8}
                  accessibilityLabel={`Remove ${skill}`}
                >
                  <Text style={styles.removeSkill}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptySkills}>
            No skills added yet.
          </Text>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.sage} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.headerSubtitle}>
              Tell the community what you know and what you want to learn.
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.messageBoxError}>
            <Text style={styles.messageTextError}>{error}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.messageBoxSuccess}>
            <Text style={styles.messageTextSuccess}>
              {successMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal details</Text>

          <Text style={styles.fieldLabel}>Full name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.secondary}
            autoCapitalize="words"
          />

          <Text style={styles.fieldLabel}>About you</Text>
          <TextInput
            style={[styles.textInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="A little about your learning journey..."
            placeholderTextColor={COLORS.secondary}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />

          <Text style={styles.characterCount}>
            {bio.length}/300
          </Text>
        </View>

        {renderSkillSection(
          "Skills I can teach",
          "Share skills you can help others learn.",
          skillsToTeach,
          teachInput,
          setTeachInput,
          setSkillsToTeach,
        )}

        {renderSkillSection(
          "Skills I want to learn",
          "Add skills you would like to practice with someone.",
          skillsToLearn,
          learnInput,
          setLearnInput,
          setSkillsToLearn,
        )}

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save profile</Text>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          Your profile helps SkillBridge find meaningful skill exchanges.
        </Text>
      </ScrollView>

      <SkillBridgeNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.secondary,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  backText: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -3,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.sage,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    color: COLORS.navy,
    fontSize: 30,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: COLORS.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 16,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
  },
  bioInput: {
    minHeight: 105,
  },
  characterCount: {
    color: COLORS.secondary,
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },
  addSkillRow: {
    flexDirection: "row",
    gap: 10,
  },
  skillInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingHorizontal: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
  skillList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 15,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.sageLight,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    gap: 9,
  },
  skillText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "600",
  },
  removeSkill: {
    color: COLORS.secondary,
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "500",
  },
  emptySkills: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 14,
  },
  saveButton: {
    backgroundColor: COLORS.navy,
    minHeight: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonPressed: {
    backgroundColor: COLORS.navyLight,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },
  footerNote: {
    color: COLORS.secondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
    paddingHorizontal: 12,
  },
  messageBoxError: {
    backgroundColor: "#FCEDEC",
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
  },
  messageTextError: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  messageBoxSuccess: {
    backgroundColor: COLORS.sageLight,
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
  },
  messageTextSuccess: {
    color: COLORS.success,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});