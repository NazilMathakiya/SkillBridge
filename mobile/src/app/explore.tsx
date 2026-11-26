
import { useCallback, useState } from 'react';
import SkillBridgeNav from '../components/SkillBridgeNav';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { apiRequest } from '@/lib/api';

const COLORS = {
  background: '#F7F8F5',
  white: '#FFFFFF',
  navy: '#172B4D',
  navyLight: '#243B5E',
  sage: '#789783',
  sageLight: '#E9F0EA',
  text: '#1E293B',
  muted: '#7B8493',
  border: '#E3E7E2',
  danger: '#B42318',
};

type MatchUser = {
  id: string;
  name: string;
  email: string;
  bio?: string;
  skillsToTeach: string[];
  skillsToLearn: string[];
};

type SkillMatch = {
  user: MatchUser;
  matchingSkills: {
    youCanTeach: string[];
    theyCanTeach: string[];
  };
};

type MatchesResponse = {
  success: boolean;
  count: number;
  matches: SkillMatch[];
};

type ProfileResponse = {
  success: boolean;
  user: {
    name: string;
    skillsToTeach: string[];
    skillsToLearn: string[];
  };
};

type SentRequest = {
  _id: string;
  receiver: string | { _id: string };
  offeredSkill: string;
  wantedSkill: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type SentRequestsResponse = {
  success: boolean;
  requests: SentRequest[];
};

export default function ExploreScreen() {
  const [matches, setMatches] = useState<SkillMatch[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadExplore = useCallback(async () => {
    try {
      setError('');

      const token = await SecureStore.getItemAsync('skillbridge_token');

      if (!token) {
        router.replace('/');
        return;
      }

      const [profileResponse, matchesResponse, requestsResponse] =
        await Promise.all([
          apiRequest<ProfileResponse>('/profile/me', { token }),
          apiRequest<MatchesResponse>('/users/matches', { token }),
          apiRequest<SentRequestsResponse>(
            '/exchange-requests/sent',
            { token },
          ),
        ]);

      setMyName(profileResponse.user.name);
      setMatches(matchesResponse.matches ?? []);
      setSentRequests(requestsResponse.requests ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load SkillBridge.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExplore();
    }, [loadExplore]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadExplore();
  }

  function getReceiverId(user: MatchUser) {
    return user.id;
  }

  function hasPendingRequest(match: SkillMatch) {
    const receiverId = getReceiverId(match.user);

    return sentRequests.some((request) => {
      const requestReceiver =
        typeof request.receiver === 'string'
          ? request.receiver
          : request.receiver._id;

      return (
        requestReceiver === receiverId &&
        request.status === 'pending'
      );
    });
  }

  async function handleSendRequest(match: SkillMatch) {
    const user = match.user;
    const receiverId = getReceiverId(user);

    const offeredSkill = match.matchingSkills.youCanTeach[0];
    const wantedSkill = match.matchingSkills.theyCanTeach[0];

    if (!offeredSkill || !wantedSkill) {
      Alert.alert(
        'No matching skills',
        'This user does not have a valid reciprocal skill exchange.',
      );
      return;
    }

    setRequestingId(receiverId);

    try {
      const token = await SecureStore.getItemAsync('skillbridge_token');

      if (!token) {
        router.replace('/');
        return;
      }

      await apiRequest('/exchange-requests', {
        method: 'POST',
        token,
        body: {
          receiverId,
          offeredSkill,
          wantedSkill,
        },
      });

      Alert.alert(
        'Request sent!',
        `You offered to teach ${offeredSkill} and learn ${wantedSkill}.`,
      );

      await loadExplore();
    } catch (err) {
      Alert.alert(
        'Request failed',
        err instanceof Error
          ? err.message
          : 'Could not send the exchange request.',
      );
    } finally {
      setRequestingId(null);
    }
  }

  function openProfile() {
    router.push('/profile' as any);
  }

  function handleLogout() {
    Alert.alert(
      'Confirm logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('skillbridge_token');
              router.replace('/');
            } catch {
              Alert.alert(
                'Logout failed',
                'Could not log you out. Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.sage} />
        <Text style={styles.loadingText}>
          Finding your skill matches...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.sage}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SKILLBRIDGE</Text>
            <Text style={styles.heading}>Explore</Text>
            <Text style={styles.greeting}>
              {myName
                ? `Hello, ${myName}`
                : 'Find your next skill exchange'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={openProfile}
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.profileButtonText}>Profile</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Text style={styles.introIconText}>↔</Text>
          </View>

          <View style={styles.introContent}>
            <Text style={styles.introTitle}>
              Learn by exchanging
            </Text>
            <Text style={styles.introDescription}>
              Teach what you know. Learn what someone else knows.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Your skill matches
            </Text>
            <Text style={styles.sectionSubtitle}>
              People who can teach you and learn from you
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>{matches.length}</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>
              Could not load matches
            </Text>
            <Text style={styles.messageText}>{error}</Text>

            <Pressable
              onPress={loadExplore}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>
              No matches yet
            </Text>
            <Text style={styles.emptyDescription}>
              Add skills you want to teach and skills you want to learn.
              We will find people with a reciprocal exchange.
            </Text>

            <Pressable
              onPress={openProfile}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                Complete your profile
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.matchesList}>
            {matches.map((match) => {
              const user = match.user;
              const pending = hasPendingRequest(match);
              const isRequesting = requestingId === user.id;

              return (
                <View key={user.id} style={styles.matchCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>

                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {user.name}
                      </Text>
                      <Text style={styles.userEmail}>
                        {user.email}
                      </Text>
                    </View>
                  </View>

                  {!!user.bio && (
                    <Text style={styles.userBio} numberOfLines={3}>
                      {user.bio}
                    </Text>
                  )}

                  <View style={styles.exchangeBox}>
                    <View style={styles.exchangeSection}>
                      <Text style={styles.exchangeLabel}>
                        THEY CAN TEACH YOU
                      </Text>

                      <View style={styles.skillsRow}>
                        {match.matchingSkills.theyCanTeach.map(
                          (skill) => (
                            <View
                              key={skill}
                              style={styles.learnSkill}
                            >
                              <Text style={styles.learnSkillText}>
                                {skill}
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    </View>

                    <View style={styles.exchangeDivider}>
                      <Text style={styles.exchangeArrow}>↕</Text>
                    </View>

                    <View style={styles.exchangeSection}>
                      <Text style={styles.exchangeLabel}>
                        YOU CAN TEACH THEM
                      </Text>

                      <View style={styles.skillsRow}>
                        {match.matchingSkills.youCanTeach.map(
                          (skill) => (
                            <View
                              key={skill}
                              style={styles.teachSkill}
                            >
                              <Text style={styles.teachSkillText}>
                                {skill}
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleSendRequest(match)}
                    disabled={pending || isRequesting}
                    style={({ pressed }) => [
                      styles.requestButton,
                      pending && styles.requestButtonPending,
                      pressed &&
                        !pending &&
                        !isRequesting &&
                        styles.pressed,
                    ]}
                  >
                    {isRequesting ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text
                        style={[
                          styles.requestButtonText,
                          pending &&
                            styles.requestButtonPendingText,
                        ]}
                      >
                        {pending
                          ? 'Request pending'
                          : 'Send exchange request'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomNote}>
          <Text style={styles.bottomNoteText}>
            Keep learning. Keep sharing.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom navigation bar */}
      <SkillBridgeNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: {
    color: COLORS.sage,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 7,
  },
  heading: {
    color: COLORS.navy,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  greeting: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },
  profileButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileButtonText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#F0D8D5',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  introCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
  },
  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#344B6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introIconText: {
    color: COLORS.white,
    fontSize: 27,
    fontWeight: '700',
  },
  introContent: {
    flex: 1,
  },
  introTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  introDescription: {
    color: '#D3DCE7',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    color: COLORS.sage,
    fontSize: 13,
    fontWeight: '800',
  },
  matchesList: {
    gap: 16,
  },
  matchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.sage,
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  userEmail: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  userBio: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  exchangeBox: {
    backgroundColor: '#FBFCFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 16,
  },
  exchangeSection: {
    gap: 9,
  },
  exchangeLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  learnSkill: {
    backgroundColor: COLORS.sageLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  learnSkillText: {
    color: COLORS.sage,
    fontSize: 12,
    fontWeight: '700',
  },
  teachSkill: {
    backgroundColor: '#EAF0F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  teachSkillText: {
    color: COLORS.navyLight,
    fontSize: 12,
    fontWeight: '700',
  },
  exchangeDivider: {
    alignItems: 'center',
    marginVertical: 10,
  },
  exchangeArrow: {
    color: COLORS.sage,
    fontSize: 18,
    fontWeight: '700',
  },
  requestButton: {
    height: 48,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  requestButtonPending: {
    backgroundColor: COLORS.sageLight,
  },
  requestButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  requestButtonPendingText: {
    color: COLORS.sage,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 26,
  },
  emptyIcon: {
    color: COLORS.sage,
    fontSize: 32,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },
  primaryButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 20,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  messageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
  },
  messageTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  messageText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNote: {
    alignItems: 'center',
    marginTop: 28,
  },
  bottomNoteText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.75,
  },
});
