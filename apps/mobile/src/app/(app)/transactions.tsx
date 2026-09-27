import { formatRupiah, PAYMENT_LABELS } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { PeriodTabs } from '@/components/period-tabs';
import { RoleGate } from '@/components/role-gate';
import { Empty, ErrorView, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { addDays, shortDate, time, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function TransactionsScreen() {
  return (
    <RoleGate route="transactions">
      <Transactions />
    </RoleGate>
  );
}

function Transactions() {
  const outletId = useOutletId();
  const today = todayJakarta();
  const [date, setDate] = useState(today);
  const orders = useQuery({ queryKey: ['orders', outletId, date], queryFn: () => api.orders(outletId, date), enabled: !!outletId });
  const total = (orders.data ?? []).reduce((s, o) => s + o.total, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundAlt }}>
      <PeriodTabs
        options={[0, -1, -2, -3, -4, -5, -6].map((d) => addDays(today, d)).map((d) => ({ value: d, label: d === today ? 'Hari ini' : shortDate(d).slice(0, -5) }))}
        value={date}
        onChange={setDate}
      />
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorView error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={orders.data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} />}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryText}>{orders.data.length} transaksi</Text>
              <Text style={styles.summaryTotal}>{formatRupiah(total)}</Text>
            </View>
          }
          ListEmptyComponent={<Empty icon="receipt-outline" title="Belum ada transaksi" />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.number}>
                  #{item.number} · {time(item.createdAt)}
                </Text>
                <Text style={styles.lines} numberOfLines={2}>
                  {item.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                </Text>
                <Text style={styles.meta}>
                  {PAYMENT_LABELS[item.method]} · {item.cashierName}
                </Text>
              </View>
              <Text style={styles.total}>{formatRupiah(item.total)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingTop: 0, gap: space.sm },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  summaryText: { fontFamily: fonts.medium, color: colors.navy },
  summaryTotal: { fontFamily: fonts.bold, fontSize: 18, color: colors.primary },
  row: { flexDirection: 'row', gap: space.md, backgroundColor: colors.white, borderRadius: radius.md, padding: space.md, alignItems: 'center' },
  number: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  lines: { fontSize: 13, color: colors.ink },
  meta: { fontSize: 11, color: colors.muted },
  total: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
});
