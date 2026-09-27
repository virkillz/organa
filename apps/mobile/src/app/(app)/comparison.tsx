import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, type CountLine } from '@organa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categoryOptions, OptionSheet } from '@/components/category-picker';
import { RoleGate } from '@/components/role-gate';
import { Button } from '@/components/ui/button';
import { Empty, ErrorView, Loading, StatusPill, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { longDate, qty } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function ComparisonScreen() {
  return (
    <RoleGate route="comparison">
      <Comparison />
    </RoleGate>
  );
}

/** "Stok Pintar vs Stok Nyata": system (expected) vs counted stock, with signed variance. */
function Comparison() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const outletId = useOutletId();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['stock-categories'], queryFn: api.stockCategories });
  const [picking, setPicking] = useState(false);
  // The route param is the source of truth, so arriving from a stock count selects its category.
  const categoryId = params.categoryId ?? categories.data?.find((c) => c.name === 'Daging')?.id ?? categories.data?.[0]?.id ?? null;
  const setCategoryId = (id: string | null) => router.setParams({ categoryId: id ?? undefined });

  const latest = useQuery({
    queryKey: ['count-latest', outletId, categoryId],
    queryFn: () => api.latestCount(outletId, categoryId ?? undefined),
    enabled: !!outletId && !!categoryId,
  });
  const commit = useMutation({
    mutationFn: (id: string) => api.commitCount(id),
    // Refresh everything except 'count-open': refetching it would POST and open a new, empty count.
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'count-open' }),
  });

  const count = latest.data?.count;
  const counted = count?.lines.filter((l) => l.counted !== null) ?? [];
  const categoryName = categories.data?.find((c) => c.id === categoryId)?.name ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      <Toolbar filter={`Stock: ${categoryName}`} onFilter={() => setPicking(true)} />
      {latest.isPending ? (
        <Loading />
      ) : latest.isError ? (
        <ErrorView error={latest.error} onRetry={() => latest.refetch()} />
      ) : !count || !counted.length ? (
        <View style={{ padding: space.md, gap: space.md }}>
          <Empty icon="clipboard-outline" title="Belum ada stok opname" body={`Hitung stok fisik ${categoryName} untuk membandingkan dengan stok sistem.`} />
          <Button title="MULAI STOK OPNAME" onPress={() => categoryId && router.push({ pathname: '/stock-count/[categoryId]', params: { categoryId } })} />
        </View>
      ) : (
        <FlatList
          data={counted}
          keyExtractor={(l) => l.ingredientId}
          contentContainerStyle={[styles.list, { paddingBottom: space.xl * 3 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={latest.isRefetching} onRefresh={() => latest.refetch()} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.date}>{longDate(count.committedAt ?? count.createdAt)}</Text>
              <StatusPill label={count.status === 'OPEN' ? 'Belum disimpan' : `Disimpan · ${count.countedByName}`} tone={count.status === 'OPEN' ? 'warning' : 'ok'} />
            </View>
          }
          renderItem={({ item }) => <Row line={item} />}
          ListFooterComponent={
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total selisih nilai</Text>
              <Text style={[styles.totalValue, count.totalVarianceValue < 0 && { color: colors.danger }]}>{formatRupiah(count.totalVarianceValue)}</Text>
            </View>
          }
        />
      )}
      {count && counted.length ? (
        <View style={[styles.footer, { paddingBottom: space.md + insets.bottom }]}>
          {commit.isError ? <Text variant="error">{commit.error.message}</Text> : null}
          {count.status === 'OPEN' ? (
            <Button title="SIMPAN STOK AKTUAL" onPress={() => commit.mutate(count.id)} loading={commit.isPending} />
          ) : (
            <Button title="HITUNG ULANG" variant="outline" onPress={() => categoryId && router.push({ pathname: '/stock-count/[categoryId]', params: { categoryId } })} />
          )}
        </View>
      ) : null}
      <OptionSheet visible={picking} title="Kategori stok" value={categoryId} options={categoryOptions(categories.data ?? [], false)} onSelect={setCategoryId} onClose={() => setPicking(false)} />
    </View>
  );
}

function Row({ line }: { line: CountLine }) {
  const v = line.variance ?? 0;
  const tone = Math.abs(v) < 0.5 ? 'match' : v < 0 ? 'short' : 'surplus';
  const bg = { match: colors.successBg, short: colors.dangerBg, surplus: '#FDE2D2' }[tone];
  const fg = { match: colors.primaryDark, short: colors.danger, surplus: colors.warning }[tone];
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name="cube-outline" size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {line.name}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.small}>Expected</Text>
            <Text style={styles.small}>{qty(line.expected, line.baseUnit)}</Text>
          </View>
          <View style={[styles.split, { flex: 1 }]}>
            <Text style={styles.small}>Actual</Text>
            <Text style={styles.small}>{qty(line.counted ?? 0, line.baseUnit)}</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={styles.selisih}>Selisih</Text>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeText, { color: fg }]}>
            {v > 0 ? '+' : ''}
            {qty(v, line.baseUnit)}
          </Text>
        </View>
        {line.varianceValue ? <Text style={[styles.small, { color: fg }]}>{formatRupiah(line.varianceValue)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, gap: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  date: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2.5, borderColor: colors.primary, padding: space.sm + 4 },
  icon: { paddingRight: space.sm, borderRightWidth: 1.5, borderRightColor: colors.primary },
  split: { paddingLeft: space.sm, borderLeftWidth: 1.5, borderLeftColor: colors.primary },
  small: { fontSize: 12, color: colors.navy },
  selisih: { fontStyle: 'italic', fontSize: 12, color: colors.navy },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 72, alignItems: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  totalLabel: { fontFamily: fonts.medium, color: colors.navy },
  totalValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, gap: space.sm, backgroundColor: colors.backgroundAlt },
});
