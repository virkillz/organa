import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BarChart, shortRupiah } from '@/components/charts';
import { RoleGate } from '@/components/role-gate';
import { Card, ErrorView, Loading } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { longDate, monthLabel, todayJakarta } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function DashboardScreen() {
  return (
    <RoleGate route="dashboard">
      <Dashboard />
    </RoleGate>
  );
}

function Dashboard() {
  const outletId = useOutletId();
  const name = useSession((s) => s.user?.name);
  const outlets = useQuery({ queryKey: ['outlets'], queryFn: api.outlets });
  const dash = useQuery({ queryKey: ['dashboard', outletId], queryFn: () => api.dashboard(outletId), enabled: !!outletId, refetchInterval: 30_000 });
  const outletName = outlets.data?.find((o) => o.id === outletId)?.name;

  if (dash.isPending) return <Loading />;
  if (dash.isError) return <ErrorView error={dash.error} onRetry={() => dash.refetch()} />;
  const d = dash.data;
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  return (
    <ScrollView style={{ backgroundColor: colors.backgroundAlt }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => dash.refetch()} />}>
      <View>
        <Text style={styles.hello}>Halo, {name?.split(' ')[0]}</Text>
        <Text style={styles.sub}>
          {outletName} · {longDate(todayJakarta())}
        </Text>
      </View>

      <Card>
        <Text style={styles.label}>Penjualan hari ini</Text>
        <Text style={styles.big}>{formatRupiah(d.salesToday)}</Text>
        <Text style={styles.sub}>
          {d.ordersToday} transaksi{d.topProduct ? ` · Terlaris: ${d.topProduct.name} (${d.topProduct.qty})` : ''}
        </Text>
        <View style={{ marginTop: space.sm }}>
          <BarChart
            data={d.salesLast7Days.map((s) => ({ label: days[new Date(`${s.date}T00:00:00Z`).getUTCDay()]!, value: s.total }))}
            format={(v) => formatRupiah(v)}
            highlightLast
            accessibilityLabel="Penjualan 7 hari terakhir"
          />
        </View>
      </Card>

      <View style={styles.row}>
        <Tile icon="trash-outline" tone={colors.navy} label={`Kerugian ${monthLabel(todayJakarta().slice(0, 7), true)}`} value={`Rp ${shortRupiah(d.wasteThisMonth)}`} onPress={() => router.navigate('/analysis')} />
        <Tile icon="cart-outline" tone={colors.danger} label="Stok kritis" value={`${d.criticalCount} item`} onPress={() => router.navigate({ pathname: '/stock/list', params: { status: 'critical' } })} />
      </View>
      <View style={styles.row}>
        <Tile icon="time-outline" tone={colors.warning} label="Potensi kedaluwarsa" value={`${d.expiringCount} batch`} onPress={() => router.navigate('/stock/expiring')} />
        <Tile icon="analytics-outline" tone={colors.primary} label="Prediksi & saran" value="Lihat" onPress={() => router.navigate('/forecast')} />
      </View>
    </ScrollView>
  );
}

function Tile({ icon, tone, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; tone: string; label: string; value: string; onPress: () => void }) {
  return (
    <Card style={{ flex: 1, gap: space.sm }} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.icon, { backgroundColor: tone }]}>
        <Ionicons name={icon} size={18} color={colors.white} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  hello: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
  sub: { fontSize: 12, color: colors.navy },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  big: { fontFamily: fonts.bold, fontSize: 28, color: colors.primary },
  value: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  row: { flexDirection: 'row', gap: space.md },
  icon: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
