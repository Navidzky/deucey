import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { useProfile } from '../lib/use-profile';

export default function Index() {
  const { session, initializing } = useAuth();
  const { profile, loading } = useProfile();

  if (initializing || (session && loading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile || !profile.has_location) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/courts" />;
}
