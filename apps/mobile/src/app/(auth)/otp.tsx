import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { PinInput } from '@/components/ui/pin-input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  MISSED_CALL: 'missed call',
};

export default function Otp() {
  const { challengeId, channel, destination } = useLocalSearchParams<{
    challengeId: string;
    channel: string;
    destination: string;
  }>();
  const signIn = useSession((s) => s.signIn);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (value = code) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      // The root navigator's guards move to setup or the app once the session is set.
      await signIn(await api.verifyOtp({ challengeId, code: value }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kode OTP salah');
      setCode('');
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Verifikasi OTP"
      subtitle={`Masukkan 6 digit kode yang dikirim via ${CHANNEL_LABELS[channel] ?? channel} ke ${destination}`}
      footer={<Button title="VERIFIKASI" onPress={() => verify()} loading={loading} disabled={code.length !== 6} />}>
      <PinInput value={code} onChange={setCode} onComplete={verify} secure={false} error={!!error} accessibilityLabel="Kode OTP" />
      {error ? <Text variant="error">{error}</Text> : null}
      {__DEV__ ? <Text style={styles.hint}>Mode demo: gunakan kode 123456</Text> : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: { textAlign: 'center', fontSize: 12, color: colors.muted },
});
