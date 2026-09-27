import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AreaChart } from '@/components/charts';
import { PeriodTabs } from '@/components/period-tabs';
import { RankedItems } from '@/components/ranked-items';
import { ErrorView, Loading, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { addMonths, monthLabel, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function ForecastScreen() {
  const outletId = useOutletId();
  const next = addMonths(todayJakarta().slice(0, 7), 1);
  const [month, setMonth] = useState(next);
  const forecast = useQuery({ queryKey: ['forecast', outletId, month], queryFn: () => api.forecast(outletId, month), enabled: !!outletId });
  const f = forecast.data;

  return (
    <View style={{ flex: 1 }}>
      <Toolbar filter="Forecast Bulanan" />
      <PeriodTabs options={[0, 1, 2].map((i) => addMonths(next, i)).map((m) => ({ value: m, label: monthLabel(m).toUpperCase() }))} value={month} onChange={setMonth} />
      {forecast.isPending ? (
        <Loading />
      ) : forecast.isError ? (
        <ErrorView error={forecast.error} onRetry={() => forecast.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={forecast.isRefetching} onRefresh={() => forecast.refetch()} />}>
          <View style={styles.panel}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/forecast/suggestions', params: { month } })} style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Kesimpulan & Saran</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.navy} />
            </Pressable>
            <View style={styles.panelBody}>
              <AreaChart
                data={[...f!.history.map((h) => ({ label: monthLabel(h.month), value: h.wasteValue })), { label: monthLabel(month), value: f!.predictedWasteValue }]}
                estimateFrom={f!.history.length}
                format={(v) => formatRupiah(v)}
                accessibilityLabel="Kerugian per bulan dan prediksi"
              />
              <Text style={styles.caption}>
                Prediksi kerugian {formatRupiah(f!.predictedWasteValue)} di bulan {monthLabel(month, true)} (garis putus-putus)
              </Text>
              <View style={styles.kpis}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiLabel}>Prediksi Kejadian Terbuang</Text>
                  <Text style={styles.kpiValue}>{f!.predictedWasteEvents} batch</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiLabel}>Prediksi Kerugian</Text>
                  <Text style={styles.kpiValue}>{formatRupiah(f!.predictedWasteValue, { space: true })}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Prediksi Bahan Terbuang</Text>
            </View>
            <View style={styles.panelBody}>
              <RankedItems items={f!.items} />
            </View>
          </View>

          <View style={styles.row}>
            <Advice title="Kurangi pembelian" icon="trending-down" tone={colors.warning} items={f!.buyLess} />
            <Advice title="Tambah pembelian" icon="trending-up" tone={colors.primary} items={f!.buyMore} />
          </View>
          <Text style={styles.method}>Metode: {f!.method}</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Advice({ title, icon, tone, items }: { title: string; icon: 'trending-down' | 'trending-up'; tone: string; items: { ingredientId: string; name: string; reason: string }[] }) {
  return (
    <View style={[styles.panel, { flex: 1 }]}>
      <View style={[styles.panelHeader, { justifyContent: 'flex-start', gap: 6 }]}>
        <Ionicons name={icon} size={16} color={tone} />
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      <View style={[styles.panelBody, { gap: space.sm }]}>
        {items.length ? (
          items.map((i) => (
            <View key={i.ingredientId}>
              <Text style={styles.adviceName}>{i.name}</Text>
              <Text style={styles.adviceReason}>{i.reason}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.adviceReason}>Tidak ada.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingTop: 0, gap: space.md, paddingBottom: space.xl * 2 },
  panel: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primaryTint, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.primaryTint },
  panelTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  panelBody: { padding: space.md },
  caption: { fontSize: 12, color: colors.primary, textAlign: 'center', fontStyle: 'italic', marginTop: 4 },
  kpis: { flexDirection: 'row', marginTop: space.sm },
  kpiLabel: { fontSize: 12, color: colors.navy },
  kpiValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  row: { flexDirection: 'row', gap: space.md },
  adviceName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  adviceReason: { fontSize: 11, color: colors.muted },
  method: { fontSize: 11, color: colors.muted, textAlign: 'center' },
});
