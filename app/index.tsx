import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/store/SessionProvider';
import { theme } from '@/lib/theme';

// Entry point: the root layout's effect handles routing; show a splash meanwhile.
export default function Index() {
  const { loading, session, profile } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.color.neon} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.activeVehicle) return <Redirect href="/onboarding/ride-selector" />;
  return <Redirect href="/(tabs)/radar" />;
}
