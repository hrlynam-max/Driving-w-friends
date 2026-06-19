import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/lib/theme';
import type { GateState } from '@/store/radarStore';

const LABEL: Record<GateState, { text: string; color: string }> = {
  dormant: { text: '◌ TRACKING OFF', color: theme.color.textDim },
  active: { text: '◉ LIVE', color: theme.color.success },
  convoy: { text: '⇶ CONVOY', color: theme.color.neonAlt },
};

// Surfaces the activity gate so the rider knows when GPS is on vs. off.
export function GateBadge({ gate }: { gate: GateState }) {
  const { text, color } = LABEL[gate];
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(8,8,11,0.7)',
  },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
