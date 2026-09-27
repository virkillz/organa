import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLE_LABELS, WEEKDAY_SHORT_ID, type Employee } from '@organa/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmployeeFields, useEmployeeForm } from '@/components/employee-form';
import { RoleGate } from '@/components/role-gate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, radius, space } from '@/theme/tokens';

export default function EmployeesScreen() {
  return (
    <RoleGate route="employees">
      <Employees />
    </RoleGate>
  );
}

function Employees() {
  const outletId = useSession((s) => s.activeOutletId) ?? '';
  const deviceToken = useSession((s) => s.deviceToken);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [binding, setBinding] = useState(false);
  const query = useQuery({ queryKey: ['employees', outletId], queryFn: () => api.employees(outletId), enabled: !!outletId });

  const onCreated = (employee: Employee) => {
    queryClient.setQueryData<Employee[]>(['employees', outletId], (list = []) =>
      [...list, employee].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setAdding(false);
  };

  const bindDevice = async () => {
    setBinding(true);
    try {
      const { deviceToken: token } = await api.registerDevice(outletId, 'Perangkat karyawan');
      await useSession.getState().setDeviceToken(token);
      Alert.alert('Perangkat terdaftar', 'Karyawan cabang ini sekarang bisa log in di perangkat ini dengan kode unik.');
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setBinding(false);
    }
  };

  return (
    <View style={styles.root}>
      {query.isPending ? (
        <ActivityIndicator style={{ marginTop: space.xl }} color={colors.primary} />
      ) : query.isError ? (
        <Text variant="error" style={styles.pad}>
          {query.error.message}
        </Text>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada karyawan di cabang ini.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{item.name}</Text>
                <Text variant="caption">
                  {ROLE_LABELS[item.role]} · {item.shiftDays.map((d) => WEEKDAY_SHORT_ID[d]).join(' ')}
                </Text>
              </View>
              {!item.active ? <Text variant="caption">Nonaktif</Text> : null}
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <Button title="TAMBAH KARYAWAN" onPress={() => setAdding(true)} />
              <Button
                title={deviceToken ? 'DAFTARKAN ULANG PERANGKAT INI' : 'DAFTARKAN PERANGKAT INI'}
                variant="outline"
                onPress={bindDevice}
                loading={binding}
              />
              <Text variant="caption" style={styles.center}>
                Perangkat terdaftar menampilkan login karyawan untuk cabang yang dipilih.
              </Text>
            </View>
          }
        />
      )}
      <AddEmployeeModal visible={adding} outletId={outletId} onClose={() => setAdding(false)} onCreated={onCreated} />
    </View>
  );
}

function AddEmployeeModal({
  visible,
  outletId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  outletId: string;
  onClose: () => void;
  onCreated: (e: Employee) => void;
}) {
  const { form, submit, submitting } = useEmployeeForm(outletId, onCreated);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text variant="heading">Tambah Karyawan</Text>
          <EmployeeFields form={form} />
        </ScrollView>
        <View style={styles.modalActions}>
          <Button title="BATAL" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button title="SIMPAN" onPress={submit} loading={submitting} style={{ flex: 1 }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundAlt },
  pad: { padding: space.lg },
  list: { padding: space.md, gap: space.sm },
  empty: { textAlign: 'center', color: colors.muted, marginVertical: space.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryTint,
    padding: space.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { marginTop: space.lg, gap: space.sm },
  center: { textAlign: 'center' },
  modal: { flex: 1, backgroundColor: colors.background },
  modalBody: { padding: space.lg, gap: space.lg },
  modalActions: { flexDirection: 'row', gap: space.sm, padding: space.lg },
});
