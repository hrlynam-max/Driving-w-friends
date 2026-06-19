import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/lib/theme';
import type { Ping } from '@/store/radarStore';

function dist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function PingCard({ ping, onLinkUp }: { ping: Ping; onLinkUp: (p: Ping) => void }) {
  const accent = theme.scene[ping.scene] ?? theme.color.neon;
  return (
    <Pressable style={styles.row} onPress={() => onLinkUp(ping)}>
      <View style={[styles.dot, { backgroundColor: accent, shadowColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label} numberOfLines={1}>
          {ping.label}
        </Text>
        <Text style={styles.sub}>
          @{ping.handle} · {dist(ping.meters)}
          {ping.speedKph != null ? ` · ${ping.speedKph} km/h` : ''}
        </Text>
      </View>
      <Text style={[styles.cta, { color: accent }]}>LINK UP →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { color: theme.color.text, fontWeight: '700', fontSize: 15 },
  sub: { color: theme.color.textDim, fontSize: 12, marginTop: 2 },
  cta: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});
