import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { directionsUrl } from '../../lib/location';
import { theme } from '../../lib/theme';

type Court = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  court_type: 'public' | 'private' | 'unknown';
  surface: string;
  num_courts: number;
  lit: boolean;
  distance_km: number;
};

export default function Courts() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('nearby_courts_for_me');
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setCourts((data as Court[]) ?? []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Courts near you</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={courts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: theme.space(2), gap: theme.space(1.5) }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No courts found nearby yet. Pull to refresh.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => Linking.openURL(directionsUrl(item.latitude, item.longitude, item.name))}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>
            </View>
            {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
            <View style={styles.tagRow}>
              <Tag label={item.court_type} />
              {item.num_courts > 1 ? <Tag label={`${item.num_courts} courts`} /> : null}
              {item.lit ? <Tag label="lit" /> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  title: {
    fontSize: theme.font.subtitle,
    fontWeight: '700',
    color: theme.color.text,
    paddingHorizontal: theme.space(2),
    paddingTop: theme.space(2),
  },
  error: { color: theme.color.danger, paddingHorizontal: theme.space(2), marginTop: theme.space(1) },
  empty: { color: theme.color.muted, textAlign: 'center', marginTop: theme.space(4) },
  card: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.space(2),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text, flex: 1 },
  distance: { fontSize: theme.font.small, color: theme.color.muted, marginLeft: theme.space(1) },
  address: { fontSize: theme.font.small, color: theme.color.muted, marginTop: theme.space(0.5) },
  tagRow: { flexDirection: 'row', gap: theme.space(1), marginTop: theme.space(1) },
  tag: {
    backgroundColor: '#f0f5f2',
    borderRadius: 999,
    paddingHorizontal: theme.space(1),
    paddingVertical: 2,
  },
  tagText: { fontSize: theme.font.small, color: theme.color.primary },
});
