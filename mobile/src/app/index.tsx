
import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { loginUser, registerUser } from '@/lib/api';

const COLORS = {
  navy: '#172B4D',
  navyLight: '#243B5E',
  sage: '#789783',
  sageLight: '#E9F0EA',
  background: '#F7F8F5',
  white: '#FFFFFF',
  text: '#1E293B',
  muted: '#7B8493',
  border: '#E3E7E2',
  danger: '#B42318',
};

export default function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();

    if (isRegister && !name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    if (!cleanEmail || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Password too short',
        'Your password must contain at least 6 characters.',
      );
      return;
    }

    setLoading(true);

    try {
      const response = isRegister
        ? await registerUser({
            name: name.trim(),
            email: cleanEmail,
            password,
          })
        : await loginUser({
            email: cleanEmail,
            password,
          });

      await SecureStore.setItemAsync('skillbridge_token', response.token);

      router.replace('/explore');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Please try again later.';

      Alert.alert(
        isRegister ? 'Registration failed' : 'Login failed',
        message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetters}>SB</Text>
            </View>
            <Text style={styles.brandName}>SkillBridge</Text>
          </View>

          <View style={styles.hero}>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrowText}>GROW THROUGH EXCHANGE</Text>
            </View>

            <Text style={styles.title}>
              Skills are better{'\n'}
              <Text style={styles.titleAccent}>when shared.</Text>
            </Text>

            <Text style={styles.subtitle}>
              Connect with people who know what you want to learn—and want to
              learn what you know.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {isRegister ? 'Create your account' : 'Welcome back'}
              </Text>
              <Text style={styles.formSubtitle}>
                {isRegister
                  ? 'Start exchanging skills today.'
                  : 'Sign in to continue your learning journey.'}
              </Text>
            </View>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="words"
                  autoComplete="name"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>

              <View style={styles.passwordInputContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry={!showPassword}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  style={styles.passwordInput}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />

                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.passwordToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !loading && styles.submitPressed,
                loading && styles.submitDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {isRegister ? 'Create account' : 'Sign in'}
                  </Text>
                  <Text style={styles.submitArrow}>→</Text>
                </>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isRegister
                  ? 'Already have an account?'
                  : "Don't have an account?"}
              </Text>

              <Pressable
                onPress={() => {
                  setIsRegister(!isRegister);
                  setPassword('');
                  setShowPassword(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.switchAction}>
                  {isRegister ? 'Sign in' : 'Create one'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Learn together. Build something meaningful.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetters: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandName: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  hero: {
    marginTop: 42,
    marginBottom: 28,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.sage,
  },
  eyebrowText: {
    color: COLORS.sage,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: COLORS.navy,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  titleAccent: {
    color: COLORS.sage,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 340,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#172B4D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  formSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  inputGroup: {
    marginBottom: 17,
  },
  label: {
    color: COLORS.navyLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 9,
  },
  input: {
    height: 52,
    backgroundColor: '#FBFCFA',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: COLORS.text,
    fontSize: 14,
  },
  passwordInputContainer: {
    height: 52,
    backgroundColor: '#FBFCFA',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    color: COLORS.text,
    fontSize: 14,
  },
  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  passwordToggleText: {
    color: COLORS.sage,
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    height: 54,
    borderRadius: 13,
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    gap: 12,
  },
  submitPressed: {
    backgroundColor: COLORS.navyLight,
    transform: [{ scale: 0.99 }],
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  submitArrow: {
    color: COLORS.white,
    fontSize: 20,
    marginTop: -2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 22,
  },
  switchText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  switchAction: {
    color: COLORS.sage,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
