import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { OptionSheet } from '@/components/category-picker';
import { AreaChart } from '@/components/charts';
import { PeriodTabs } from '@/components/period-tabs';
import { RankedItems } from '@/components/ranked-items';
import { ErrorView, Loading, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { addMonths, monthLabel, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Mode = 'year' | 'month';

export default function Analysis() {
  const outletId = useOutletId();
  const thisMonth = todayJakarta().slice(0, 7);
  const [mode, setMode] = useState<Mode>('year');
  const [pickedYear, setYear] = useState(thisMonth.slice(0, 4));
  const [month, setMonth] = useState(thisMonth);
  const [picking, setPicking] = useState(false);
  // Every response lists the years that have data; if the picked year has none, show the latest one.
  const years = useQuery({ queryKey: ['analysis', outletId, pickedYear], queryFn: () => api.analysis(outletId, pickedYear), enabled: !!outletId });
  const available = years.data?.availableYears.map(String) ?? [];
  const year = !available.length || available.includes(pickedYear) ? pickedYear : available.at(-1)!;
  const period = mode === 'year' ? year : month;

  const chartYear = mode === 'year' ? year : month.slice(0, 4);
  const yearData = useQuery({ queryKey: ['analysis', outletId, chartYear], queryFn: () => api.analysis(outletId, chartYear), enabled: !!outletId });
  const monthData = useQuery({ queryKey: ['analysis', outletId, month], queryFn: () => api.analysis(outletId, month), enabled: !!outletId && mode === 'month' });
  const data = mode === 'year' ? yearData : monthData;

  const yearTabs = available.length ? available : [year];

  // Year view: months up to now. Month view: the six months ending at the selected one.
  const inRange = (yearData.data?.months ?? []).filter((m) => m.month <= thisMonth && (mode === 'year' || (m.month > addMonths(month, -6) && m.month <= month)));
  // Months before the first recorded waste are "no data yet", not zero waste: leave them out.
  const firstWithData = inRange.findIndex((m) => m.wasteValue > 0);
  const chartMonths = firstWithData > 0 ? inRange.slice(firstWithData) : inRange;
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5));

  return (
    <View style={{ flex: 1 }}>
      <Toolbar filter={mode === 'year' ? 'Analisis Tahunan' : 'Analisis Bulanan'} onFilter={() => setPicking(true)} />
      <PeriodTabs
        options={mode === 'year' ? yearTabs.map((y) => ({ value: y, label: y })) : months.map((m) => ({ value: m, label: monthLabel(m).toUpperCase() }))}
        value={period}
        onChange={mode === 'year' ? setYear : setMonth}
      />
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <ErrorView error={data.error} onRetry={() => data.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={data.isRefetching} onRefresh={() => data.refetch()} />}>
          <View style={styles.panel}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/analysis/suggestions', params: { period } })} style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Kesimpulan & Saran</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.navy} />
            </Pressable>
            <View style={styles.panelBody}>
              <AreaChart
                data={chartMonths.map((m) => ({ label: monthLabel(m.month), value: m.wasteValue }))}
                format={(v) => `kerugian ${formatRupiah(v)}`}
                accessibilityLabel="Kerugian bahan terbuang per bulan"
              />
              <View style={styles.kpis}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiLabel}>Kejadian Terbuang</Text>
                  <Text style={styles.kpiValue}>{data.data.totalWasteEvents} batch</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kpiLabel}>Total Kerugian</Text>
                  <Text style={styles.kpiValue}>{formatRupiah(data.data.totalWasteValue, { space: true })}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Akumulasi Bahan Terbuang</Text>
            </View>
            <View style={styles.panelBody}>
              <RankedItems items={data.data.topItems} />
            </View>
          </View>

          {data.data.stockouts.length ? (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Sering Habis (Stock Out)</Text>
              </View>
              <View style={[styles.panelBody, { gap: space.sm }]}>
                {data.data.stockouts.slice(0, 5).map((s) => (
                  <View key={s.ingredientId} style={styles.outRow}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={{ flex: 1 }}>{s.name}</Text>
                    <Text style={styles.outCount}>{s.count}x habis</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable accessibilityRole="button" onPress={() => router.navigate('/forecast')} style={styles.cta}>
            <Text style={styles.ctaText}>PREDIKSI STOK & SARAN STRATEGIS</Text>
          </Pressable>
        </ScrollView>
      )}
      <OptionSheet
        visible={picking}
        title="Jenis analisis"
        value={mode}
        options={[
          { value: 'year', label: 'Analisis Tahunan' },
          { value: 'month', label: 'Analisis Bulanan' },
        ]}
        onSelect={setMode}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingTop: 0, gap: space.md, paddingBottom: space.xl * 2 },
  panel: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primaryTint, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.primaryTint },
  panelTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  panelBody: { padding: space.md },
  kpis: { flexDirection: 'row', marginTop: space.sm },
  kpiLabel: { fontSize: 12, color: colors.navy },
  kpiValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
  outRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  outCount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.danger },
  cta: { backgroundColor: colors.primaryDark, borderRadius: radius.sm, padding: space.md, alignItems: 'center' },
  ctaText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
