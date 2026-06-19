import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRadarStore } from '@/store/radarStore';
import { useConvoy } from '@/hooks/useConvoy';
import { RadarMap } from '@/components/RadarMap';
import { NeonButton } from '@/components/NeonButton';
import { theme } from '@/lib/theme';

function fmtEta(s?: number) {
  if (s == null) return '—';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDist(m?: number) {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// "Join Convoy": live route from me to the selected ride, re-routing as we move.
export default function Convoy() {
  const router = useRouter();
  const me = useRadarStore((s) => s.me);
  const pingsMap = useRadarStore((s) => s.pings);
  const pings = useMemo(() => Object.values(pingsMap), [pingsMap]);
  const setConvoyTarget = useRadarStore((s) => s.setConvoyTarget);
  const { route, target } = useConvoy();

  // Clear the convoy target when leaving (drops the gate back to active/dormant).
  useEffect(() => () => setConvoyTarget(null), [setConvoyTarget]);

  const leave = () => {
    setConvoyTarget(null);
    router.back();
  };

  return (
    <View style={styles.root}>
      <RadarMap me={me} pings={pings} route={route} onSelect={() => {}} />

      <SafeAreaView style={styles.card} edges={['bottom']}>
        <View style={styles.handle} />
        {target ? (
          <>
            <Text style={styles.kicker}>JOINING CONVOY</Text>
            <Text style={styles.title}>{target.label}</Text>
            <Text style={styles.sub}>@{target.handle}</Text>
            <View style={styles.stats}>
              <Stat label="DISTANCE" value={fmtDist(route?.distanceMeters)} />
              <Stat label="ETA" value={fmtEta(route?.durationSeconds)} />
            </View>
            <NeonButton
              label="LEAVE CONVOY"
              variant="outline"
              color={theme.color.danger}
              onPress={leave}
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Ride left the radar</Text>
            <NeonButton label="BACK" onPress={leave} style={{ marginTop: 12 }} />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    padding: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.border,
    marginBottom: 14,
  },
  kicker: { color: theme.color.neonAlt, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: theme.color.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  sub: { color: theme.color.textDim, fontSize: 14, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16, marginVertical: 18 },
  stat: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: 14,
  },
  statLabel: { color: theme.color.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: theme.color.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
});
