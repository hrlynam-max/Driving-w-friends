import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '@/store/SessionProvider';
import { theme } from '@/lib/theme';

function RootNavigator() {
  const { session, profile, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    const inAuth = group === '(auth)';

    if (!session && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (session && !profile?.activeVehicle && group !== 'onboarding') {
      // Signed in but no active ride -> force ride selection.
      router.replace('/onboarding/ride-selector');
    } else if (session && profile?.activeVehicle && (inAuth || group === 'onboarding')) {
      router.replace('/(tabs)/radar');
    }
  }, [session, profile, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="convoy/[userId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
