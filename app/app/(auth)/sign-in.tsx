import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/google-auth';
import { theme } from '../../lib/theme';

export default function SignIn() {
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
      <Text style={styles.title}>DEUCEY</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    padding: theme.space(3),
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.font.body,
    color: theme.color.muted,
    textAlign: 'center',
    marginTop: theme.space(1),
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
    textAlign: 'center',
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
