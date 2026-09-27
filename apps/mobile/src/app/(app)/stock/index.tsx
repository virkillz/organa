import { formatRupiah } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, ErrorView, Fab, Kpi, Loading, Tile, TileGrid, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, space } from '@/theme/tokens';

export default function StockDashboard() {
  const outletId = useOutletId();
  const summary = useQuery({ queryKey: ['stock-summary', outletId], queryFn: () => api.stockSummary(outletId), enabled: !!outletId });

  return (
    <View style={{ flex: 1 }}>
      <Toolbar
        filter="All Stock"
        actions={[
          { icon: 'search-outline', label: 'Cari stok', onPress: () => router.push('/stock/list') },
          { icon: 'list-outline', label: 'Daftar stok', onPress: () => router.push('/stock/list') },
        ]}
      />
      {summary.isPending ? (
        <Loading />
      ) : summary.isError ? (
        <ErrorView error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={() => summary.refetch()} />}>
          <Card tone="warning" onPress={() => router.push('/stock/expiring')} accessibilityLabel="Potensi kedaluwarsa">
            <View style={styles.row}>
              <Kpi icon="time-outline" iconBg={colors.warning} label={'Potensi\nKedaluarsa'} value={`${summary.data.expiring.count} batch`} />
              <Kpi icon="trending-down" iconBg={colors.warning} label={'Potensi\nKerugian'} value={formatRupiah(summary.data.expiring.value, { space: true })} />
            </View>
          </Card>
          <Card tone="navy" onPress={() => router.push('/stock/expired')} accessibilityLabel="Telah kedaluwarsa bulan ini">
            <View style={styles.row}>
              <Kpi icon="trash-outline" iconBg={colors.navy} label={'Telah\nKedaluarsa'} value={`${summary.data.expired.count} batch`} />
              <Kpi icon="cash-outline" iconBg={colors.navy} label={'Telah Rugi\n(bulan ini)'} value={formatRupiah(summary.data.expired.value, { space: true })} />
            </View>
          </Card>
          <View style={styles.row}>
            <Card tone="danger" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/stock/list', params: { status: 'critical' } })} accessibilityLabel="Stok kritis">
              <Kpi icon="cart-outline" iconBg={colors.danger} label="Critical Stock" value={`${summary.data.criticalCount} item`} />
            </Card>
            <Card style={{ flex: 1, justifyContent: 'center' }} onPress={() => router.navigate('/analysis')} accessibilityLabel="Analisis stok">
              <View style={[styles.row, { alignItems: 'center' }]}>
                <View style={styles.analysisIcon}>
                  <Text style={styles.analysisIconText}>≡</Text>
                </View>
                <Text style={styles.analysisText}>Analisis Stok</Text>
              </View>
            </Card>
          </View>
          <TileGrid>
            {summary.data.categories.map((c) => (
              <Tile
                key={c.id}
                icon={c.icon as never}
                label={c.name}
                badge={c.itemCount || undefined}
                badgeTone={c.criticalCount ? 'danger' : c.expiringCount ? 'warning' : 'navy'}
                onPress={() => router.push({ pathname: '/stock/list', params: { categoryId: c.id } })}
              />
            ))}
          </TileGrid>
          <View style={styles.fabs}>
            <Fab label={'BULK\nIMPORT'} onPress={() => Alert.alert('Bulk import', 'Impor stok dari Excel/CSV segera hadir.')} />
            <Fab icon="add" onPress={() => router.push('/stock/in')} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  row: { flexDirection: 'row', gap: space.md },
  analysisIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  analysisIconText: { fontSize: 26, color: colors.navy },
  analysisText: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, flexShrink: 1, lineHeight: 20 },
  fabs: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
});
