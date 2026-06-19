import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/SessionProvider';
import { useRadar, type SelfProfile } from '@/hooks/useRadar';
import { useLocationManager } from '@/hooks/useLocationManager';
import { useConvoy } from '@/hooks/useConvoy';
import { useRadarStore, type Ping } from '@/store/radarStore';
import { requestPermissions } from '@/services/location';
import { rideTag, type Scene } from '@/lib/sceneTag';
import { RadarMap } from '@/components/RadarMap';
import { PingCard } from '@/components/PingCard';
import { GateBadge } from '@/components/GateBadge';
import { theme } from '@/lib/theme';

export default function Radar() {
  const { profile } = useSession();
  const router = useRouter();
  const me = useRadarStore((s) => s.me);
  const gate = useRadarStore((s) => s.gate);
  const pingsMap = useRadarStore((s) => s.pings);
  const pings = useMemo(
    () => Object.values(pingsMap).sort((a, b) => a.meters - b.meters),
    [pingsMap],
  );
  const setConvoyTarget = useRadarStore((s) => s.setConvoyTarget);

  const [self, setSelf] = useState<SelfProfile | null>(null);
  const [radarFocused, setRadarFocused] = useState(false);

  // Ask for location permission once.
  useEffect(() => {
    requestPermissions();
  }, []);

  // Resolve our own ride tag (scene/label) from the active vehicle.
  useEffect(() => {
    if (!profile?.activeVehicle) return;
    let active = true;
    supabase
      .from('generations')
      .select('name, year_start, models(name, makes(name, country))')
      .eq('id', profile.activeVehicle.generation_id)
      .single()
      .then(({ data }) => {
        if (!active || !data) return;
        const g = data as any; // nested embed; hand-written types don't model relations
        const md = g.models as { name: string; makes: { name: string; country: string | null } };
        const { scene, label } = rideTag({
          country: md.makes.country,
          make: md.makes.name,
          model: md.name,
          generation: g.name,
          yearStart: g.year_start,
        });
        setSelf({
          userId: profile.id,
          handle: profile.handle,
          scene: scene as Scene,
          label,
          vehicleId: profile.activeVehicle!.id,
          visibilityPublic: profile.visibility === 'public',
        });
      });
    return () => {
      active = false;
    };
  }, [profile?.activeVehicle?.id, profile?.visibility, profile?.handle, profile?.id]);

  // Track whether the radar is foregrounded + focused (drives the activity gate).
  useFocusEffect(
    useCallback(() => {
      setRadarFocused(AppState.currentState === 'active');
      const sub = AppState.addEventListener('change', (s) => setRadarFocused(s === 'active'));
      return () => {
        setRadarFocused(false);
        sub.remove();
      };
    }, []),
  );

  const { broadcast, writeBehind } = useRadar(self);
  useLocationManager({ radarFocused, broadcast, writeBehind });
  const { route } = useConvoy();

  const onSelect = useCallback(
    (p: Ping) => {
      setConvoyTarget(p.userId);
      router.push(`/convoy/${p.userId}`);
    },
    [router, setConvoyTarget],
  );

  const header = useMemo(
    () => (
      <View style={styles.topRow}>
        <Text style={styles.brand}>OVERDRIVE</Text>
        <GateBadge gate={gate} />
      </View>
    ),
    [gate],
  );

  return (
    <View style={styles.root}>
      <RadarMap me={me} pings={pings} route={route} onSelect={onSelect} />

      <SafeAreaView style={styles.overlayTop} pointerEvents="box-none">
        {header}
      </SafeAreaView>

      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>
          {pings.length > 0 ? `${pings.length} NEARBY` : 'SCANNING…'}
        </Text>
        {pings.slice(0, 4).map((p) => (
          <PingCard key={p.userId} ping={p} onLinkUp={onSelect} />
        ))}
        {pings.length === 0 && (
          <Text style={styles.empty}>
            No rides on the radar yet. Tracking stays off until there's action nearby.
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brand: { color: theme.color.neon, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: theme.color.border,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.border,
    marginBottom: 10,
  },
  sheetTitle: {
    color: theme.color.textDim,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 12,
    marginBottom: 10,
  },
  empty: { color: theme.color.textDim, fontSize: 13, paddingVertical: 8, lineHeight: 18 },
});
