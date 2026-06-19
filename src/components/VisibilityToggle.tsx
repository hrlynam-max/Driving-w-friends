import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import type { RiderVisibility } from '@/types/db';

// Public = your obfuscated ping shows on the open radar to anyone.
// Private = hidden from the radar; you can still browse others.
export function VisibilityToggle({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: RiderVisibility;
  onChange: (v: RiderVisibility) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function set(next: RiderVisibility) {
    if (next === value || saving) return;
    setSaving(true);
    onChange(next); // optimistic
    const { error } = await supabase.from('users').update({ visibility: next }).eq('id', userId);
    if (error) onChange(value); // revert on failure
    setSaving(false);
  }

  return (
    <View style={styles.wrap}>
      {(['public', 'private'] as RiderVisibility[]).map((opt) => {
        const on = value === opt;
        const color = opt === 'public' ? theme.color.success : theme.color.textDim;
        return (
          <Pressable
            key={opt}
            onPress={() => set(opt)}
            style={[styles.seg, on && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.segText, { color: on ? theme.color.bg : theme.color.textDim }]}>
              {opt === 'public' ? 'PUBLIC' : 'PRIVATE'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    padding: 4,
    gap: 4,
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  segText: { fontWeight: '800', fontSize: 13, letterSpacing: 1 },
});
