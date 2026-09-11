import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/use-profile';
import { theme } from '../../lib/theme';

type NearbyPlayer = {
  id: string;
  handle: string;
  skill_level: number | null;
  city: string | null;
  distance_km: number;
};

export default function Players() {
  const { profile, refresh: refreshProfile } = useProfile();
  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingMatch, setTogglingMatch] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('nearby_players');
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setPlayers((data as NearbyPlayer[]) ?? []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleLookingForMatch = async (value: boolean) => {
    if (!profile) return;
    setTogglingMatch(true);
    await supabase.from('profiles').update({ is_looking_for_match: value }).eq('id', profile.id);
    await refreshProfile();
    await load();
    setTogglingMatch(false);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Find a match</Text>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>I'm available to play</Text>
          <Text style={styles.toggleHint}>Only players who opt in can see or be seen by each other.</Text>
        </View>
        {togglingMatch ? (
          <ActivityIndicator color={theme.color.primary} />
        ) : (
          <Switch
            value={profile?.is_looking_for_match ?? false}
            onValueChange={toggleLookingForMatch}
            trackColor={{ true: theme.color.primary }}
          />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: theme.space(4) }} color={theme.color.primary} />
      ) : !profile?.is_looking_for_match ? (
        <Text style={styles.empty}>Turn on "available to play" to see nearby players.</Text>
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: theme.space(2), gap: theme.space(1.5) }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No available players nearby right now. Check back soon.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.handle}</Text>
                <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
              </View>
              <Text style={styles.meta}>
                {item.skill_level ? `Skill ${item.skill_level.toFixed(1)}` : 'Skill unrated'}
                {item.city ? ` · ${item.city}` : ''}
              </Text>
            </View>
          )}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  title: {
    fontSize: theme.font.subtitle,
    fontWeight: '700',
    color: theme.color.text,
    paddingHorizontal: theme.space(2),
    paddingTop: theme.space(2),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space(2),
    gap: theme.space(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    marginTop: theme.space(2),
  },
  toggleLabel: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  toggleHint: { fontSize: theme.font.small, color: theme.color.muted, marginTop: 2 },
  empty: { color: theme.color.muted, textAlign: 'center', marginTop: theme.space(4), paddingHorizontal: theme.space(3) },
  error: { color: theme.color.danger, paddingHorizontal: theme.space(2), marginTop: theme.space(1) },
  card: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.space(2),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  distance: { fontSize: theme.font.small, color: theme.color.muted },
  meta: { fontSize: theme.font.small, color: theme.color.muted, marginTop: theme.space(0.5) },
});
