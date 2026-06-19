import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail, verifyOtp } from '@/hooks/useAuth';
import { NeonButton } from '@/components/NeonButton';
import { theme } from '@/lib/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    setLoading(false);
    if (error) setError(error.message);
    else setStage('otp');
  }

  async function confirm() {
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email.trim(), token.trim());
    setLoading(false);
    if (error) setError(error.message);
    // success -> SessionProvider picks up the new session and routes onward.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View>
          <Text style={styles.brand}>OVERDRIVE</Text>
          <Text style={styles.tag}>find the night. join the convoy.</Text>
        </View>

        <View style={styles.form}>
          {stage === 'email' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={theme.color.textDim}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <NeonButton label="SEND CODE" onPress={sendCode} loading={loading} disabled={!email} />
            </>
          ) : (
            <>
              <Text style={styles.hint}>Enter the code we sent to {email}</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={theme.color.textDim}
                keyboardType="number-pad"
                value={token}
                onChangeText={setToken}
              />
              <NeonButton label="ENTER" onPress={confirm} loading={loading} disabled={!token} />
              <NeonButton
                label="← change email"
                variant="outline"
                color={theme.color.textDim}
                onPress={() => setStage('email')}
                style={{ marginTop: 10 }}
              />
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  container: { flex: 1, justifyContent: 'space-between', padding: 28, paddingVertical: 60 },
  brand: { color: theme.color.neon, fontSize: 40, fontWeight: '900', letterSpacing: 4 },
  tag: { color: theme.color.textDim, fontSize: 14, marginTop: 8, letterSpacing: 1 },
  form: { gap: 14 },
  input: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    color: theme.color.text,
    fontSize: 18,
    padding: 16,
  },
  hint: { color: theme.color.textDim, fontSize: 13 },
  error: { color: theme.color.danger, fontSize: 13, textAlign: 'center' },
});
