import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, type StockItem, type StockStatus } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { categoryOptions, OptionSheet } from '@/components/category-picker';
import { Empty, ErrorView, Loading, StatusPill, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { longDate, qty, shortDate } from '@/lib/format';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Sort = 'input' | 'expiry' | 'name';
const SORT_LABELS: Record<Sort, string> = { input: 'Tanggal Input', expiry: 'Tanggal Kedaluarsa', name: 'Nama' };
const STATUS_LABELS: Record<StockStatus, string> = { ok: 'Aman', critical: 'Kritis', expiring: 'Segera kedaluwarsa', expired: 'Kedaluwarsa' };
const STATUS_TONE = { ok: 'ok', critical: 'danger', expiring: 'warning', expired: 'navy' } as const;

export default function StockList() {
  const params = useLocalSearchParams<{ categoryId?: string; status?: StockStatus }>();
  const outletId = useOutletId();
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [status] = useState<StockStatus | undefined>(params.status);
  const [sort, setSort] = useState<Sort>(params.status ? 'name' : 'input');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [picker, setPicker] = useState<'category' | 'sort' | null>(null);

  const categories = useQuery({ queryKey: ['stock-categories'], queryFn: api.stockCategories });
  const stock = useQuery({
    queryKey: ['stock', outletId, categoryId, status],
    queryFn: () => api.stock(outletId, { categoryId: categoryId ?? undefined, status }),
    enabled: !!outletId,
  });

  const categoryName = categories.data?.find((c) => c.id === categoryId)?.name;
  const sections = useMemo(() => {
    const items = (stock.data ?? []).filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (sort === 'name') return [{ title: '', data: [...items].sort((a, b) => a.name.localeCompare(b.name)) }];
    const key = (i: StockItem) => (sort === 'input' ? i.lastInputAt?.slice(0, 10) : i.nextExpiry) ?? '';
    const sorted = [...items].sort((a, b) => (sort === 'input' ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
    const groups = new Map<string, StockItem[]>();
    for (const i of sorted) groups.set(key(i), [...(groups.get(key(i)) ?? []), i]);
    return [...groups].map(([k, data]) => ({ title: k ? longDate(k) : 'Tanpa tanggal', data }));
  }, [stock.data, sort, search]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: status === 'critical' ? 'Stok Kritis' : 'Daftar Stok' }} />
      <Toolbar
        filter={status === 'critical' ? 'Stok Kritis' : `Stock: ${categoryName ?? 'Semua'}`}
        onFilter={status ? undefined : () => setPicker('category')}
        actions={[{ icon: 'search-outline', label: 'Cari', onPress: () => setSearching((s) => !s), active: searching }]}
      />
      {searching ? (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Cari bahan" style={styles.searchInput} placeholderTextColor={colors.muted} />
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => setPicker('sort')} style={styles.sort}>
        <Text style={styles.sortText}>Urutkan: {SORT_LABELS[sort]}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.navy} />
      </Pressable>
      {stock.isPending ? (
        <Loading />
      ) : stock.isError ? (
        <ErrorView error={stock.error} onRetry={() => stock.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.ingredientId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={stock.isRefetching} onRefresh={() => stock.refetch()} />}
          ListEmptyComponent={<Empty title="Belum ada stok" body="Tambahkan stok lewat tombol + di halaman Manajemen Stok." />}
          renderSectionHeader={({ section }) => (section.title ? <Text style={styles.groupTitle}>{section.title}</Text> : null)}
          renderItem={({ item }) => <StockRow item={item} />}
        />
      )}
      <OptionSheet
        visible={picker === 'category'}
        title="Kategori stok"
        value={categoryId}
        options={categoryOptions(categories.data ?? [])}
        onSelect={setCategoryId}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === 'sort'}
        title="Urutkan"
        value={sort}
        options={(Object.keys(SORT_LABELS) as Sort[]).map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        onSelect={setSort}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function StockRow({ item }: { item: StockItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${qty(item.onHand, item.baseUnit)}`}
      onPress={() => router.push(`/stock/${item.ingredientId}`)}
      style={({ pressed }) => [styles.row, item.status === 'critical' && { borderColor: colors.danger }, pressed && { opacity: 0.8 }]}>
      <View style={styles.rowIcon}>
        <Ionicons name="cube-outline" size={26} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.qty, item.onHand <= 0 && { color: colors.danger }]}>{qty(item.onHand, item.baseUnit)}</Text>
        {item.nextExpiry ? <Text style={styles.exp}>Exp: {shortDate(item.nextExpiry)}</Text> : null}
        {item.status !== 'ok' ? <StatusPill label={STATUS_LABELS[item.status]} tone={STATUS_TONE[item.status]} /> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.valueLabel}>Stock Value</Text>
        <Text style={styles.value}>{formatRupiah(item.value, { space: true })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 10, color: colors.ink },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, paddingTop: space.md },
  sortText: { fontFamily: fonts.medium, fontStyle: 'italic', fontSize: 13, color: colors.navy },
  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl * 2 },
  groupTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy, marginTop: space.sm, marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 2.5,
    borderColor: colors.primary,
    padding: space.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  rowIcon: { paddingRight: space.sm, borderRightWidth: 1.5, borderRightColor: colors.primary },
  qty: { fontSize: 13, color: colors.ink },
  exp: { fontSize: 11, color: colors.navy },
  valueLabel: { fontSize: 12, color: colors.navy },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
});
