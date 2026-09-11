import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '../../lib/theme';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.primary,
        tabBarInactiveTintColor: theme.color.muted,
      }}
    >
      <Tabs.Screen
        name="courts"
        options={{ title: 'Courts', tabBarIcon: () => <TabIcon emoji="🎾" /> }}
      />
      <Tabs.Screen
        name="players"
        options={{ title: 'Players', tabBarIcon: () => <TabIcon emoji="🤝" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }}
      />
    </Tabs>
  );
}
