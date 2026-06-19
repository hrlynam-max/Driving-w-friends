import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/SessionProvider';
import { rideTag } from '@/lib/sceneTag';
import { NeonButton } from '@/components/NeonButton';
import { theme } from '@/lib/theme';

type GarageRow = {
  id: number;
  is_active: boolean;
  nickname: string | null;
  scene: string;
  label: string;
};

// The user's owned rides; tap to set the active one.
export default function Garage() {
  const { session, refreshProfile, profile } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<GarageRow[]>([]);

  async function load() {
    if (!session) return;
    const { data } = await supabase
      .from('vehicles')
      .select('id, is_active, nickname, generations(name, year_start, models(name, makes(name, country)))')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    setRows(
      (data ?? []).map((v: any) => {
        const g = v.generations;
        const md = g.models;
        const { scene, label } = rideTag({
          country: md.makes.country,
          make: md.makes.name,
          model: md.name,
          generation: g.name,
          yearStart: g.year_start,
        });
        return { id: v.id, is_active: v.is_active, nickname: v.nickname, scene, label };
      }),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, profile?.activeVehicle?.id]);

  async function activate(id: number) {
    if (!session) return;
    await supabase.from('vehicles').update({ is_active: false }).eq('owner_id', session.user.id);
    await supabase.from('vehicles').update({ is_active: true }).eq('id', id);
    await refreshProfile();
    load();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>GARAGE</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const accent = theme.scene[item.scene] ?? theme.color.neon;
          return (
            <Pressable
              style={[styles.card, item.is_active && { borderColor: accent }]}
              onPress={() => activate(item.id)}
            >
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.nickname ?? item.label}</Text>
                <Text style={styles.sub}>{item.label}</Text>
              </View>
              {item.is_active && <Text style={[styles.active, { color: accent }]}>ACTIVE</Text>}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <NeonButton
            label="+ ADD A RIDE"
            variant="outline"
            onPress={() => router.push('/onboarding/ride-selector')}
            style={{ marginTop: 12 }}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  title: {
    color: theme.color.text,
    fontSize: 30,
    fontWeight: '900',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 16,
    marginBottom: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { color: theme.color.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.color.textDim, fontSize: 12, marginTop: 2 },
  active: { fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});
