import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/store/SessionProvider';
import { signOut } from '@/hooks/useAuth';
import { VisibilityToggle } from '@/components/VisibilityToggle';
import { NeonButton } from '@/components/NeonButton';
import { theme } from '@/lib/theme';

export default function ProfileScreen() {
  const { profile, setProfileLocal } = useSession();
  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>@{profile.handle}</Text>

        <View style={styles.block}>
          <Text style={styles.section}>RADAR VISIBILITY</Text>
          <VisibilityToggle
            userId={profile.id}
            value={profile.visibility}
            onChange={(v) => setProfileLocal({ visibility: v })}
          />
          <Text style={styles.help}>
            {profile.visibility === 'public'
              ? 'Your obfuscated ping is visible to anyone on the radar.'
              : "You're hidden from the radar. You can still see other rides."}
          </Text>
        </View>

        <View style={{ flex: 1 }} />
        <NeonButton
          label="SIGN OUT"
          variant="outline"
          color={theme.color.danger}
          onPress={() => signOut()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  body: { flex: 1, padding: 24 },
  title: { color: theme.color.text, fontSize: 30, fontWeight: '900', marginBottom: 28 },
  block: { gap: 12 },
  section: { color: theme.color.neon, fontWeight: '800', letterSpacing: 1.5, fontSize: 12 },
  help: { color: theme.color.textDim, fontSize: 13, lineHeight: 18 },
});
