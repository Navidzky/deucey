import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useProfile } from '../lib/use-profile';
import { supabase } from '../lib/supabase';
import type { CapturedLocation } from '../lib/location';
import { LocationPicker } from '../components/LocationPicker';
import { theme } from '../lib/theme';

const SKILL_LEVELS = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

export default function Onboarding() {
  const { session } = useAuth();
  const { refresh } = useProfile();
  const [handle, setHandle] = useState('');
  const [skill, setSkill] = useState<number>(3.5);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!session?.user) return;
    setError(null);

    const cleanHandle = handle.trim();
    if (cleanHandle.length < 3 || cleanHandle.length > 24) {
      setError('Pick a display name between 3 and 24 characters. This is what other players see — not your real name.');
      return;
    }
    if (!location) {
      setError('Share your location so we can find courts and players near you.');
      return;
    }

    setSubmitting(true);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: session.user.id,
      handle: cleanHandle,
      skill_level: skill,
      city: location.city,
      home_location: `SRID=4326;POINT(${location.longitude} ${location.latitude})`,
    });
    setSubmitting(false);

    if (upsertError) {
      setError(
        upsertError.code === '23505'
          ? 'That display name is taken — try another.'
          : upsertError.message
      );
      return;
    }

    await refresh();
    router.replace('/(tabs)/courts');
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>
        Other players only ever see your display name and skill level — never your real name or exact address.
      </Text>

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. BaselineBoilermaker"
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        maxLength={24}
      />

      <Text style={styles.label}>Skill level (self-rated NTRP)</Text>
      <View style={styles.skillRow}>
        {SKILL_LEVELS.map((level) => (
          <Pressable
            key={level}
            style={[styles.skillChip, skill === level && styles.skillChipActive]}
            onPress={() => setSkill(level)}
          >
            <Text style={[styles.skillChipText, skill === level && styles.skillChipTextActive]}>
              {level.toFixed(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Location</Text>
      <LocationPicker currentCity={location?.city} onChange={setLocation} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.submit} onPress={submit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={theme.color.primaryText} />
        ) : (
          <Text style={styles.submitText}>Continue</Text>
        )}
      </Pressable>
    </View>
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
  },
  subtitle: {
    fontSize: theme.font.small,
    color: theme.color.muted,
    marginTop: theme.space(1),
    marginBottom: theme.space(3),
  },
  label: {
    fontSize: theme.font.small,
    color: theme.color.muted,
    marginBottom: theme.space(0.5),
    marginTop: theme.space(2),
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1.5),
    fontSize: theme.font.body,
  },
  skillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(1),
  },
  skillChip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 999,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
  },
  skillChipActive: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  skillChipText: {
    color: theme.color.text,
  },
  skillChipTextActive: {
    color: theme.color.primaryText,
    fontWeight: '600',
  },
  submit: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingVertical: theme.space(1.5),
    alignItems: 'center',
    marginTop: theme.space(3),
  },
  submitText: {
    color: theme.color.primaryText,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.font.small,
    marginTop: theme.space(2),
  },
});
