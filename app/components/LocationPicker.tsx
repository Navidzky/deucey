import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureCurrentLocation, searchLocations, type CapturedLocation } from '../lib/location';
import { theme } from '../lib/theme';

type Props = {
  currentCity?: string | null;
  onChange: (location: CapturedLocation) => void;
};

export function LocationPicker({ currentCity, onChange }: Props) {
  const [locating, setLocating] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchLocations>>>([]);
  const [error, setError] = useState<string | null>(null);

  const useDeviceLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const loc = await captureCurrentLocation();
      onChange(loc);
      setManualOpen(false);
      setResults([]);
    } catch (e: any) {
      setError(e.message ?? 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setError(null);
    setSearching(true);
    try {
      const found = await searchLocations(query.trim());
      setResults(found);
      if (found.length === 0) setError('No matches — try a more specific city or address.');
    } catch (e: any) {
      setError(e.message ?? 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: Awaited<ReturnType<typeof searchLocations>>[number]) => {
    onChange({ latitude: r.latitude, longitude: r.longitude, city: r.city });
    setManualOpen(false);
    setResults([]);
    setQuery('');
  };

  return (
    <View style={{ gap: theme.space(1) }}>
      <Pressable style={styles.locationButton} onPress={useDeviceLocation} disabled={locating}>
        {locating ? (
          <ActivityIndicator color={theme.color.primary} />
        ) : (
          <Text style={styles.locationButtonText}>
            {currentCity ? `📍 ${currentCity} — tap to refresh` : '📍 Share my location'}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setManualOpen((open) => !open)}>
        <Text style={styles.manualToggle}>
          {manualOpen ? 'Cancel' : 'Location wrong or blocked? Enter it manually'}
        </Text>
      </Pressable>

      {manualOpen ? (
        <View style={{ gap: theme.space(1) }}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="City or address, e.g. West Lafayette, IN"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              returnKeyType="search"
            />
            <Pressable style={styles.searchButton} onPress={runSearch} disabled={searching}>
              {searching ? (
                <ActivityIndicator color={theme.color.primaryText} />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </Pressable>
          </View>
          {results.map((r, i) => (
            <Pressable key={i} style={styles.resultRow} onPress={() => pickResult(r)}>
              <Text style={styles.resultText} numberOfLines={2}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locationButton: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingVertical: theme.space(1.5),
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  manualToggle: {
    textAlign: 'center',
    color: theme.color.primary,
    fontSize: theme.font.small,
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.space(1),
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1.5),
    fontSize: theme.font.body,
  },
  searchButton: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(2),
    justifyContent: 'center',
  },
  searchButtonText: {
    color: theme.color.primaryText,
    fontWeight: '600',
  },
  resultRow: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    padding: theme.space(1.5),
  },
  resultText: {
    fontSize: theme.font.small,
    color: theme.color.text,
  },
  error: {
    color: theme.color.danger,
    fontSize: theme.font.small,
  },
});
