import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, type ExpiryRow } from '@organa/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Card, Empty, ErrorView, Kpi, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { longDate, qty, shortDate } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Batches grouped by expiry date, under a KPI header (Potensi / Telah Kedaluarsa). */
export function ExpiryList({ query, tone, labels }: { query: UseQueryResult<ExpiryRow[]>; tone: 'warning' | 'navy'; labels: [string, string] }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;
  const rows = query.data;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const groups = new Map<string, ExpiryRow[]>();
  for (const r of rows) groups.set(r.expiryDate, [...(groups.get(r.expiryDate) ?? []), r]);
  const color = tone === 'warning' ? colors.warning : colors.navy;

  return (
    <SectionList
      sections={[...groups].map(([date, data]) => ({ title: longDate(date), data }))}
      keyExtractor={(r) => r.batchId}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      ListHeaderComponent={
        <Card tone={tone} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Kpi icon={tone === 'warning' ? 'time-outline' : 'trash-outline'} iconBg={color} label={labels[0]} value={`${rows.length} batch`} />
            <Kpi icon="cash-outline" iconBg={color} label={labels[1]} value={formatRupiah(total, { space: true })} />
          </View>
        </Card>
      }
      ListEmptyComponent={<Empty icon="checkmark-circle-outline" title="Tidak ada data" body="Tidak ada bahan pada daftar ini." />}
      renderSectionHeader={({ section }) => <Text style={styles.group}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/stock/${item.ingredientId}`)} style={[styles.row, { borderColor: color }]}>
          <Ionicons name="cube-outline" size={26} color={color} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{item.name}</Text>
            <Text style={{ fontSize: 13 }}>{qty(item.qty, item.baseUnit)}</Text>
            <Text style={[styles.exp, { color: tone === 'navy' ? colors.danger : colors.navy }]}>Exp: {shortDate(item.expiryDate)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, color: colors.navy }}>Stock Value</Text>
            <Text style={[styles.value, tone === 'navy' && { color: colors.danger }]}>{formatRupiah(item.value, { space: true })}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.sm, paddingBottom: space.xl * 2 },
  group: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2.5, padding: space.md },
  exp: { fontSize: 11 },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
});
