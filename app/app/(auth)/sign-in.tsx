import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/google-auth';
import { theme } from '../../lib/theme';

const logo = require('../../assets/logo.png');

export default function SignIn() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password (6+ characters).');
      return;
    }
    setSubmitting(true);
    const { data, error: authError } =
      mode === 'sign-up'
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === 'sign-up' && !data.session) {
      setNotice("Check your email for a confirmation link, then come back and sign in.");
      setMode('sign-in');
      return;
    }
    router.replace('/');
  };

  const submitGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.leftPane, isWide && styles.leftPaneWide]}>
            {!isWide && (
              <Image source={logo} style={styles.logoSmall} resizeMode="contain" />
            )}

            <Text style={styles.wordmark}>DEUCEY</Text>
            <Text style={styles.headline}>Let's play tennis.</Text>
            <Text style={styles.subtitle}>Find someone to play with, nearby.</Text>

            <View style={styles.form}>
              <Pressable style={styles.googleButton} onPress={submitGoogle} disabled={googleSubmitting}>
                {googleSubmitting ? (
                  <ActivityIndicator color={theme.color.text} />
                ) : (
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <TextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable style={styles.button} onPress={submit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={theme.color.primaryText} />
                ) : (
                  <Text style={styles.buttonText}>{mode === 'sign-up' ? 'Sign up' : 'Sign in'}</Text>
                )}
              </Pressable>

              <Pressable onPress={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>
                <Text style={styles.switchMode}>
                  {mode === 'sign-up' ? 'Already have an account? Sign in' : "New here? Sign up"}
                </Text>
              </Pressable>
            </View>
          </View>

          {isWide && (
            <View style={styles.rightPane}>
              <Image source={logo} style={styles.logoWide} resizeMode="contain" />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space(3),
  },
  layout: {
    width: '100%',
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(6),
    maxWidth: 1040,
    alignSelf: 'center',
  },
  leftPane: {
    width: '100%',
  },
  leftPaneWide: {
    flex: 1,
    maxWidth: 440,
  },
  rightPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWide: {
    width: '100%',
    height: 420,
  },
  logoSmall: {
    width: 160,
    height: 125,
    alignSelf: 'center',
    marginBottom: theme.space(2),
  },
  wordmark: {
    fontSize: theme.font.small,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.color.muted,
    marginBottom: theme.space(1),
  },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.color.text,
    marginBottom: theme.space(1),
  },
  subtitle: {
    fontSize: theme.font.body,
    color: theme.color.muted,
    marginBottom: theme.space(4),
  },
  form: {
    gap: theme.space(1.5),
  },
  googleButton: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingVertical: theme.space(1.5),
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  googleButtonText: {
    color: theme.color.text,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(1),
    marginVertical: theme.space(0.5),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.color.border,
  },
  dividerText: {
    color: theme.color.muted,
    fontSize: theme.font.small,
  },
  notice: {
    color: theme.color.primary,
    fontSize: theme.font.small,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1.5),
    fontSize: theme.font.body,
  },
  button: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.space(1.5),
    alignItems: 'center',
    marginTop: theme.space(1),
  },
  buttonText: {
    color: theme.color.primaryText,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  switchMode: {
    textAlign: 'center',
    color: theme.color.primary,
    marginTop: theme.space(2),
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.font.small,
  },
});
