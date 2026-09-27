import { ROLE_LABELS, type Employee } from '@organa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { EmployeeFields, useEmployeeForm } from '@/components/employee-form';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, radius, space } from '@/theme/tokens';

export default function EmployeeSetup() {
  const outletId = useSession((s) => s.activeOutletId) ?? '';
  const { setDeviceToken, setSetupPending } = useSession.getState();
  const queryClient = useQueryClient();
  const [added, setAdded] = useState<Employee[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const { form, submit, submitting } = useEmployeeForm(outletId, (e) => setAdded((list) => [...list, e]));

  /** Binds this device to the outlet so employees can log in here, then opens the app. */
  const finish = async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      const { deviceToken } = await api.registerDevice(outletId, 'Perangkat utama');
      await setDeviceToken(deviceToken);
      await queryClient.invalidateQueries();
      await setSetupPending(false);
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      setFinishing(false);
    }
  };

  return (
    <AuthScreen
      title="Pengaturan Karyawan"
      align="left"
      showBack={false}
      footer={
        <>
          <Button title="TAMBAH KARYAWAN" variant="outline" onPress={submit} loading={submitting} />
          <Button title={added.length ? 'KONFIRMASI' : 'LEWATI UNTUK SEKARANG'} onPress={finish} loading={finishing} />
          {finishError ? <Text variant="error">{finishError}</Text> : null}
        </>
      }>
      {added.length > 0 ? (
        <View style={styles.added}>
          {added.map((e) => (
            <View key={e.id} style={styles.addedRow}>
              <Text variant="bodyStrong">{e.name}</Text>
              <Text variant="caption">{ROLE_LABELS[e.role]}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <EmployeeFields form={form} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  added: { backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: space.md, gap: space.sm },
  addedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
