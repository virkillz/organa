import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, STORAGE_INFO, type IngredientDetail } from '@organa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card, ErrorView, Loading, StatusPill } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { qty, shortDate } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, space } from '@/theme/tokens';

export default function StockDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const outletId = useOutletId();
  const detail = useQuery({ queryKey: ['ingredient-stock', id, outletId], queryFn: () => api.ingredientStock(id, outletId), enabled: !!outletId });
  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorView error={detail.error} onRetry={() => detail.refetch()} />;
  return <DetailForm key={detail.data.id} d={detail.data} />;
}

function DetailForm({ d }: { d: IngredientDetail }) {
  const id = d.id;
  const queryClient = useQueryClient();
  const [critical, setCritical] = useState(String(Math.round(d.criticalQty)));
  const [criticalAlert, setCriticalAlert] = useState(d.criticalAlert);
  const [expiryAlert, setExpiryAlert] = useState(d.expiryAlert);

  const save = useMutation({
    mutationFn: () =>
      api.updateIngredient(id, { criticalQty: Number(critical.replace(',', '.')) || 0, criticalUnit: d.baseUnit, criticalAlert, expiryAlert }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ingredient-stock', id] });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      router.back();
    },
  });

  const firstBatch = d.batches[0];
  const unit = d.baseUnit;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Keterangan Stok' }} />
      <Text style={styles.category}>{(d.categoryName ?? '').toUpperCase()}</Text>
      <Text style={styles.caption}>Keterangan</Text>
      <Text style={styles.name}>{d.name}</Text>

      <Card>
        <View style={styles.split}>
          <Cell label="Tanggal Input" value={d.stock.lastInputAt ? shortDate(d.stock.lastInputAt) : '—'} />
          <View style={styles.divider} />
          <Cell label="Tanggal Expired" value={d.stock.nextExpiry ? shortDate(d.stock.nextExpiry) : '—'} />
        </View>
        <Toggle label="Notifikasi Aktif" value={expiryAlert} onChange={setExpiryAlert} />
      </Card>

      <Card tone={d.stock.status === 'critical' ? 'danger' : 'primary'}>
        <View style={styles.split}>
          <Cell label="Current Stock" value={qty(d.stock.onHand, unit)} danger={d.stock.onHand <= d.criticalQty} />
          <View style={styles.divider} />
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Critical Stock</Text>
            <View style={styles.criticalRow}>
              <TextInput
                accessibilityLabel="Batas stok kritis"
                value={critical}
                onChangeText={(t) => setCritical(t.replace(/[^\d.,]/g, ''))}
                keyboardType="decimal-pad"
                style={styles.criticalInput}
              />
              <Text style={styles.cellValue}>{unit}</Text>
            </View>
          </View>
        </View>
        <Toggle label="Notifikasi Aktif" value={criticalAlert} onChange={setCriticalAlert} />
      </Card>

      <View style={styles.row}>
        <Card style={{ flex: 1 }}>
          <Cell label="Penyimpanan" value={STORAGE_INFO[firstBatch?.storage ?? d.defaultStorage].label} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Cell label="Stock Value" value={formatRupiah(d.stock.value, { space: true })} />
        </Card>
      </View>

      {d.batches.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Batch ({d.batches.length})</Text>
          {d.batches.map((b) => (
            <View key={b.id} style={styles.batch}>
              <View style={{ flex: 1 }}>
                <Text style={styles.batchQty}>
                  {qty(b.qtyRemaining, unit)} <Text style={styles.batchMuted}>dari {qty(b.qtyInitial, unit)}</Text>
                </Text>
                <Text style={styles.batchMuted}>
                  Masuk {shortDate(b.receivedAt)} · Exp {shortDate(b.expiryDate)} · {b.createdByName}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.batchQty}>{formatRupiah(b.value)}</Text>
                {b.status !== 'ok' ? <StatusPill label={b.status === 'expiring' ? 'Segera exp' : 'Kedaluwarsa'} tone={b.status === 'expiring' ? 'warning' : 'navy'} /> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.by}>{firstBatch ? `Input Oleh: ${firstBatch.createdByName}` : ''}</Text>
        <Button title="SIMPAN" onPress={() => save.mutate()} loading={save.isPending} style={{ minWidth: 120, borderRadius: 8 }} />
      </View>
      {save.isError ? <Text variant="error">{save.error.message}</Text> : null}
      <Button title="TAMBAH STOK" variant="outline" onPress={() => router.push({ pathname: '/stock/in-form', params: { categoryId: d.categoryId, ingredientId: d.id } })} />
    </ScrollView>
  );
}

function Cell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, danger && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggle} hitSlop={8}>
      <Ionicons name={value ? 'notifications' : 'notifications-off-outline'} size={14} color={value ? colors.primaryLight : colors.muted} />
      <Text style={[styles.toggleText, !value && { color: colors.muted }]}>{value ? label : 'Notifikasi Mati'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  category: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, color: colors.navy },
  caption: { textAlign: 'center', fontSize: 13, color: colors.navy },
  name: { textAlign: 'center', fontFamily: fonts.bold, fontSize: 20, color: colors.navy, marginTop: -space.sm },
  split: { flexDirection: 'row', alignItems: 'stretch' },
  divider: { width: 1.5, backgroundColor: colors.primary, marginHorizontal: space.sm },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  cellLabel: { fontSize: 13, color: colors.navy },
  cellValue: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
  criticalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  criticalInput: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy, borderBottomWidth: 1.5, borderBottomColor: colors.primaryTint, minWidth: 60, textAlign: 'center', paddingVertical: 0 },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: space.sm },
  toggleText: { fontStyle: 'italic', fontSize: 11, color: colors.primaryLight },
  row: { flexDirection: 'row', gap: space.md },
  batch: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 10, padding: space.sm + 4, gap: space.sm },
  batchQty: { fontFamily: fonts.semibold, fontSize: 14 },
  batchMuted: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  by: { fontStyle: 'italic', fontSize: 12, color: colors.primaryLight },
});
