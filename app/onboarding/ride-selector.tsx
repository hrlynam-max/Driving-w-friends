import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/SessionProvider';
import { NeonButton } from '@/components/NeonButton';
import { theme } from '@/lib/theme';
import type { Generation, Make, Model } from '@/types/db';

type Step = 'make' | 'model' | 'generation';

// Drill-down: Make -> Model -> Generation (chassis). Sets the active ride.
export default function RideSelector() {
  const { session, refreshProfile } = useSession();
  const [step, setStep] = useState<Step>('make');
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [gens, setGens] = useState<Generation[]>([]);
  const [make, setMake] = useState<Make | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('makes')
      .select('*')
      .order('name')
      .then(({ data }) => setMakes(data ?? []));
  }, []);

  async function pickMake(m: Make) {
    setMake(m);
    const { data } = await supabase.from('models').select('*').eq('make_id', m.id).order('name');
    setModels(data ?? []);
    setStep('model');
  }

  async function pickModel(m: Model) {
    setModel(m);
    const { data } = await supabase
      .from('generations')
      .select('*')
      .eq('model_id', m.id)
      .order('year_start', { ascending: false });
    setGens(data ?? []);
    setStep('generation');
  }

  async function pickGeneration(g: Generation) {
    if (!session) return;
    setSaving(true);
    // Deactivate any existing active vehicle, then insert + activate the new one.
    await supabase.from('vehicles').update({ is_active: false }).eq('owner_id', session.user.id);
    await supabase.from('vehicles').insert({
      owner_id: session.user.id,
      generation_id: g.id,
      is_active: true,
    });
    await refreshProfile();
    setSaving(false);
    // Root layout effect routes us to the radar once activeVehicle exists.
  }

  const title = step === 'make' ? 'SELECT MAKE' : step === 'model' ? make?.name : model?.name;
  const back =
    step === 'model' ? () => setStep('make') : step === 'generation' ? () => setStep('model') : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR RIDE</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      {step === 'make' && (
        <FlatList
          data={makes}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row label={item.name} sub={item.country ?? ''} onPress={() => pickMake(item)} />
          )}
        />
      )}
      {step === 'model' && (
        <FlatList
          data={models}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row label={item.name} onPress={() => pickModel(item)} />}
        />
      )}
      {step === 'generation' && (
        <FlatList
          data={gens}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row
              label={item.name}
              sub={`${item.chassis_code ?? ''}  ·  ${item.year_start ?? ''}${
                item.year_end ? `–${item.year_end}` : '+'
              }`}
              onPress={() => pickGeneration(item)}
              loading={saving}
            />
          )}
        />
      )}

      {back && (
        <View style={styles.footer}>
          <NeonButton label="← BACK" variant="outline" color={theme.color.textDim} onPress={back} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({
  label,
  sub,
  onPress,
  loading,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={loading}>
      <Text style={styles.rowLabel}>{label}</Text>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  kicker: { color: theme.color.neon, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  title: { color: theme.color.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  row: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    padding: 18,
    marginBottom: 8,
  },
  rowLabel: { color: theme.color.text, fontSize: 18, fontWeight: '700' },
  rowSub: { color: theme.color.textDim, fontSize: 13, marginTop: 4, letterSpacing: 0.5 },
  footer: { padding: 16 },
});
