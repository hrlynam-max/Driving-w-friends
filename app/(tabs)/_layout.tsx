import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '@/lib/theme';

function Icon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.neon,
        tabBarInactiveTintColor: theme.color.textDim,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
      }}
    >
      <Tabs.Screen
        name="radar"
        options={{ title: 'Radar', tabBarIcon: ({ color }) => <Icon glyph="◉" color={color} /> }}
      />
      <Tabs.Screen
        name="garage"
        options={{ title: 'Garage', tabBarIcon: ({ color }) => <Icon glyph="▤" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon glyph="◆" color={color} /> }}
      />
    </Tabs>
  );
}
