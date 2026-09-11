import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/use-profile';
import type { CapturedLocation } from '../../lib/location';
import { LocationPicker } from '../../components/LocationPicker';
import { theme } from '../../lib/theme';

export default function Profile() {
  const { profile, loading, refresh } = useProfile();
  const [error, setError] = useState<string | null>(null);

  const updateLocation = async (loc: CapturedLocation) => {
    if (!profile) return;
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        city: loc.city,
        home_location: `SRID=4326;POINT(${loc.longitude} ${loc.latitude})`,
      })
      .eq('id', profile.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  };

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{profile.handle}</Text>
      <Text style={styles.meta}>
        Skill {profile.skill_level?.toFixed(1) ?? 'unrated'} · {profile.city ?? 'Location set'}
      </Text>

      <View style={styles.locationSection}>
        <LocationPicker currentCity={profile.city} onChange={updateLocation} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.privacyNote}>
        Other players only ever see your display name, skill level, and rough distance — never your exact
        location, real name, or email.
      </Text>

      <Pressable style={[styles.row, styles.signOut]} onPress={signOut}>
        <Text style={[styles.rowText, { color: theme.color.danger }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space(3) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  title: { fontSize: theme.font.title, fontWeight: '700', color: theme.color.text },
  meta: { fontSize: theme.font.body, color: theme.color.muted, marginTop: theme.space(0.5) },
  locationSection: { marginTop: theme.space(3) },
  row: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingVertical: theme.space(1.5),
    alignItems: 'center',
    marginTop: theme.space(3),
  },
  rowText: { fontSize: theme.font.body, color: theme.color.text },
  signOut: { marginTop: theme.space(2) },
  error: { color: theme.color.danger, fontSize: theme.font.small, marginTop: theme.space(1) },
  privacyNote: {
    fontSize: theme.font.small,
    color: theme.color.muted,
    marginTop: theme.space(3),
    lineHeight: 18,
  },
});
