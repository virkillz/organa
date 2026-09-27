import { ROLE_LABELS } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/fields';
import { PinInput } from '@/components/ui/pin-input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, space } from '@/theme/tokens';

export default function EmployeeLogin() {
  const deviceToken = useSession((s) => s.deviceToken);
  const signIn = useSession((s) => s.signIn);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const employeesQuery = useQuery({
    queryKey: ['device-employees', deviceToken],
    queryFn: api.deviceEmployees,
    enabled: !!deviceToken,
  });

  const login = async (value = pin) => {
    if (!employeeId) {
      setError('Pilih karyawan terlebih dahulu');
      return;
    }
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(await api.employeeLogin({ employeeId, pin: value }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kode unik salah');
      setPin('');
      setLoading(false);
    }
  };

  const ownerLogin = () => router.replace('/owner-login');

  return (
    <AuthScreen
      title={'Log in sebagai\nKaryawan'}
      subtitle="Pilih namamu dan masukkan kode unik"
      footer={
        <>
          <Button title="LOGIN" onPress={() => login()} loading={loading} disabled={!deviceToken} />
          <View style={styles.divider} />
          <Button title="LOGIN PEMILIK" onPress={ownerLogin} />
        </>
      }>
      {!deviceToken ? (
        <View style={styles.notice}>
          <Text variant="bodyStrong">Perangkat ini belum terdaftar</Text>
          <Text style={styles.noticeBody}>
            Minta pemilik untuk log in di perangkat ini dan menyelesaikan pengaturan karyawan. Setelah itu karyawan
            bisa log in dengan kode unik.
          </Text>
        </View>
      ) : employeesQuery.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : employeesQuery.isError ? (
        <Pressable onPress={() => employeesQuery.refetch()}>
          <Text variant="error">{employeesQuery.error.message} Ketuk untuk coba lagi.</Text>
        </Pressable>
      ) : (
        <>
          <SelectField
            label="Pilih Karyawan"
            placeholder="Pilih namamu"
            value={employeeId}
            onChange={setEmployeeId}
            options={employeesQuery.data.map((e) => ({ value: e.id, label: `${e.name} · ${ROLE_LABELS[e.role]}` }))}
          />
          <View style={{ gap: space.sm }}>
            <Text variant="label">6 Digit Kode Unik</Text>
            <PinInput value={pin} onChange={setPin} onComplete={login} error={!!error} />
            <Pressable
              accessibilityRole="link"
              onPress={() => Alert.alert('Lupa kode unik?', 'Minta pemilik untuk mengatur ulang kode unikmu.')}>
              <Text style={styles.forgot}>Lupa kode unik?</Text>
            </Pressable>
          </View>
        </>
      )}
      {error ? <Text variant="error">{error}</Text> : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.surfaceTint, borderRadius: 12, padding: space.md, gap: space.xs },
  noticeBody: { fontSize: 13, lineHeight: 19, color: colors.navy },
  forgot: { alignSelf: 'flex-end', fontFamily: fonts.medium, fontSize: 13, color: colors.primaryLight },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: space.md },
});
