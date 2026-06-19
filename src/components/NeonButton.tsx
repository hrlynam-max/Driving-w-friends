import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'outline';
  style?: ViewStyle;
};

export function NeonButton({
  label,
  onPress,
  color = theme.color.neon,
  disabled,
  loading,
  variant = 'solid',
  style,
}: Props) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: solid ? color : 'transparent',
          borderColor: color,
          shadowColor: color,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? theme.color.bg : color} />
      ) : (
        <Text style={[styles.label, { color: solid ? theme.color.bg : color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
