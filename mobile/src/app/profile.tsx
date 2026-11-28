
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
  navyLight: "#243B5E",
  navySoft: "#344B6A",
  background: "#F7F8F5",
  white: "#FFFFFF",
  sage: "#789783",
  sageLight: "#E9F0EA",
  text: "#1E293B",
  muted: "#7B8493",
  border: "#E3E7E2",
  danger: "#B42318",
  dangerLight: "#FCEDEC",
  success: "#427A5B",
};

export default function ProfileScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  const [skillsToTeach, setSkillsToTeach] = useState<string[]>([]);
  const [skillsToLearn, setSkillsToLearn] = useState<string[]>([]);

  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!token) {
        router.replace("/");
        return;
      }

      const response = await getMyProfile(token);

      setName(response.user.name ?? "");
      setEmail(response.user.email ?? "");
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
    // Starts asynchronous profile loading on screen mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  const completedSections = [
    Boolean(name.trim()),
    Boolean(bio.trim()),
    skillsToTeach.length > 0,
    skillsToLearn.length > 0,
  ].filter(Boolean).length;

  const completion = Math.round((completedSections / 4) * 100);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "SB";

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");
    Keyboard.dismiss();

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

      setSuccessMessage("Your profile has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function addSkill(
    value: string,
    currentSkills: string[],
    setSkills: (skills: string[]) => void,
    clearInput: (value: string) => void,
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

    clearInput("");
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

  function renderSkillSection(
    title: string,
    subtitle: string,
    type: "teach" | "learn",
    skills: string[],
    inputValue: string,
    setInputValue: (value: string) => void,
    setSkills: (skills: string[]) => void,
  ) {
    const isTeach = type === "teach";

    return (
      <View style={styles.sectionCard}>
        <View style={styles.skillSectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              isTeach
                ? styles.teachIcon
                : styles.learnIcon,
            ]}
          >
            <Text style={styles.sectionIconText}>
              {isTeach ? "↗" : "＋"}
            </Text>
          </View>

          <View style={styles.skillSectionHeading}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          </View>

          <View style={styles.skillCount}>
            <Text style={styles.skillCountText}>
              {skills.length}
            </Text>
          </View>
        </View>

        <View style={styles.addSkillRow}>
          <TextInput
            style={styles.skillInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Enter a skill..."
            placeholderTextColor={COLORS.muted}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() =>
              addSkill(
                inputValue,
                skills,
                setSkills,
                setInputValue,
              )
            }
          />

          <Pressable
            onPress={() =>
              addSkill(
                inputValue,
                skills,
                setSkills,
                setInputValue,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Add a skill to ${title}`}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {skills.length > 0 ? (
          <View style={styles.skillList}>
            {skills.map((skill) => (
              <View
                key={skill}
                style={[
                  styles.skillChip,
                  isTeach
                    ? styles.teachChip
                    : styles.learnChip,
                ]}
              >
                <Text
                  style={[
                    styles.skillText,
                    isTeach
                      ? styles.teachText
                      : styles.learnText,
                  ]}
                >
                  {skill}
                </Text>

                <Pressable
                  onPress={() =>
                    removeSkill(skill, skills, setSkills)
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${skill}`}
                >
                  <Text style={styles.removeSkill}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySkills}>
            <Text style={styles.emptySkillsText}>
              No skills added yet. Start by adding one above.
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.sage} />
        <Text style={styles.loadingText}>
          Preparing your profile...
        </Text>
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
        {/* PAGE HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>YOUR SPACE</Text>
            <Text style={styles.pageTitle}>My Profile</Text>
          </View>

          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>SB</Text>
          </View>
        </View>

        <Text style={styles.pageSubtitle}>
          Your skills, your story, and your next opportunity to learn.
        </Text>

        {/* ERROR AND SUCCESS MESSAGES */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>
              Something went wrong
            </Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              ✓ {successMessage}
            </Text>
          </View>
        ) : null}

        {/* USER OVERVIEW */}
        <View style={styles.profileCard}>
          <View style={styles.profileIdentity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.identityDetails}>
              <Text style={styles.memberLabel}>
                SKILLBRIDGE MEMBER
              </Text>

              <Text style={styles.profileName}>
                {name || "Your Name"}
              </Text>

              <Text style={styles.profileEmail}>
                {email || "Email unavailable"}
              </Text>
            </View>
          </View>

          <View style={styles.profileDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {skillsToTeach.length}
              </Text>
              <Text style={styles.statLabel}>Can teach</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {skillsToLearn.length}
              </Text>
              <Text style={styles.statLabel}>Want to learn</Text>
            </View>
          </View>
        </View>

        {/* PROFILE COMPLETION */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>
                Profile completion
              </Text>
              <Text style={styles.progressSubtitle}>
                {completedSections} of 4 sections completed
              </Text>
            </View>

            <View style={styles.progressPercentage}>
              <Text style={styles.progressPercentageText}>
                {completion}%
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${completion}%` },
              ]}
            />
          </View>

          <View style={styles.checklist}>
            {[
              { label: "Full name", done: Boolean(name.trim()) },
              { label: "About you", done: Boolean(bio.trim()) },
              {
                label: "Teaching skills",
                done: skillsToTeach.length > 0,
              },
              {
                label: "Learning goals",
                done: skillsToLearn.length > 0,
              },
            ].map((item) => (
              <View key={item.label} style={styles.checklistItem}>
                <View
                  style={[
                    styles.checkCircle,
                    item.done && styles.checkCircleDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.checkMark,
                      item.done && styles.checkMarkDone,
                    ]}
                  >
                    {item.done ? "✓" : "○"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.checklistLabel,
                    item.done && styles.checklistLabelDone,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* BUILD PROFILE HEADING */}
        <View style={styles.buildHeader}>
          <Text style={styles.buildEyebrow}>
            MAKE YOURSELF DISCOVERABLE
          </Text>
          <Text style={styles.buildTitle}>
            Build your profile
          </Text>
          <Text style={styles.buildSubtitle}>
            Help other learners understand what you can share
            and what you want to discover.
          </Text>
        </View>

        {/* PERSONAL INFORMATION */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>01</Text>
            </View>

            <View style={styles.sectionHeadingContent}>
              <Text style={styles.sectionTitle}>
                Personal information
              </Text>
              <Text style={styles.sectionSubtitle}>
                Introduce yourself to the community.
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="words"
            maxLength={60}
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>ABOUT YOU</Text>
          <TextInput
            style={[styles.textInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself, your experience, and what you enjoy learning..."
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />

          <Text style={styles.characterCount}>
            {bio.length}/300 characters
          </Text>
        </View>

        {/* TEACHING SKILLS */}
        {renderSkillSection(
          "Skills I can teach",
          "Share your knowledge with other learners.",
          "teach",
          skillsToTeach,
          teachInput,
          setTeachInput,
          setSkillsToTeach,
        )}

        {/* LEARNING SKILLS */}
        {renderSkillSection(
          "Skills I want to learn",
          "Tell the community what you want to explore.",
          "learn",
          skillsToLearn,
          learnInput,
          setLearnInput,
          setSkillsToLearn,
        )}

        {/* SAVE BUTTON */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.saveButtonText}>
                Save my profile
              </Text>
              <Text style={styles.saveArrow}>→</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          A more complete profile helps SkillBridge find meaningful
          skill exchanges for you.
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
    paddingTop: 20,
    paddingBottom: 110,
  },

  // Loading
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    marginRight: 13,
  },
  backText: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -3,
  },
  headerContent: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.sage,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  pageTitle: {
    color: COLORS.navy,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  brandMark: {
    height: 40,
    width: 40,
    borderRadius: 13,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
  },
  pageSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 22,
  },

  // Messages
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  errorTitle: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: COLORS.sageLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  successText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: "700",
  },

  // User overview card
  profileCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  profileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: COLORS.sageLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#B7CCBC",
  },
  avatarText: {
    color: COLORS.navy,
    fontSize: 23,
    fontWeight: "900",
  },
  identityDetails: {
    flex: 1,
  },
  memberLabel: {
    color: "#B8D0BF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  profileName: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  profileEmail: {
    color: "#D3DCE7",
    fontSize: 12,
    marginTop: 5,
  },
  profileDivider: {
    height: 1,
    backgroundColor: COLORS.navySoft,
    marginVertical: 19,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
  },
  statNumber: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: "800",
  },
  statLabel: {
    color: "#C6D1DF",
    fontSize: 11,
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.navySoft,
    marginHorizontal: 20,
  },

  // Profile progress
  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 30,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "800",
  },
  progressSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },
  progressPercentage: {
    minWidth: 48,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.sageLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  progressPercentageText: {
    color: COLORS.sage,
    fontSize: 14,
    fontWeight: "900",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#EDF0EC",
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 18,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.sage,
    borderRadius: 20,
  },
  checklist: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 17,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "47%",
  },
  checkCircle: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#F0F1EF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    backgroundColor: COLORS.sageLight,
  },
  checkMark: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  checkMarkDone: {
    color: COLORS.sage,
  },
  checklistLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  checklistLabelDone: {
    color: COLORS.navy,
    fontWeight: "700",
  },

  // Build profile section
  buildHeader: {
    marginBottom: 17,
  },
  buildEyebrow: {
    color: COLORS.sage,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  buildTitle: {
    color: COLORS.navy,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  buildSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },

  // Form cards
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 15,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 21,
    gap: 12,
  },
  sectionHeadingContent: {
    flex: 1,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.sageLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconText: {
    color: COLORS.sage,
    fontSize: 13,
    fontWeight: "900",
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  fieldLabel: {
    color: COLORS.navyLight,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 9,
    marginTop: 13,
  },
  textInput: {
    height: 51,
    backgroundColor: "#FBFCFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 14,
  },
  bioInput: {
    height: 116,
    paddingTop: 13,
    paddingBottom: 13,
  },
  characterCount: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "right",
    marginTop: 7,
  },

  // Skill cards
  skillSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 18,
  },
  skillSectionHeading: {
    flex: 1,
  },
  teachIcon: {
    backgroundColor: "#EAF0F7",
  },
  learnIcon: {
    backgroundColor: COLORS.sageLight,
  },
  skillCount: {
    minWidth: 29,
    height: 29,
    backgroundColor: "#F1F3F0",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  skillCountText: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "800",
  },
  addSkillRow: {
    flexDirection: "row",
    gap: 9,
  },
  skillInput: {
    flex: 1,
    height: 48,
    backgroundColor: "#FBFCFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: COLORS.text,
    fontSize: 13,
  },
  addButton: {
    minWidth: 72,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
  },
  skillList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    gap: 9,
  },
  teachChip: {
    backgroundColor: "#EAF0F7",
  },
  learnChip: {
    backgroundColor: COLORS.sageLight,
  },
  skillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  teachText: {
    color: COLORS.navyLight,
  },
  learnText: {
    color: COLORS.sage,
  },
  removeSkill: {
    color: COLORS.muted,
    fontSize: 19,
    lineHeight: 19,
    fontWeight: "500",
  },
  emptySkills: {
    backgroundColor: "#FBFCFA",
    borderRadius: 11,
    padding: 12,
    marginTop: 13,
  },
  emptySkillsText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  // Save and footer
  saveButton: {
    minHeight: 55,
    backgroundColor: COLORS.navy,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 3,
  },
  saveButtonPressed: {
    backgroundColor: COLORS.navyLight,
    opacity: 0.9,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  saveArrow: {
    color: COLORS.white,
    fontSize: 21,
    marginTop: -2,
  },
  footerNote: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 15,
    paddingHorizontal: 12,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
