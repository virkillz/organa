import Ionicons from '@expo/vector-icons/Ionicons';
import { formatRupiah, type Product } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, ErrorView, Loading, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api, assetUrl } from '@/lib/api';
import { cartCount, cartTotal, useCart } from '@/lib/cart';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function Cashier() {
  const outletId = useOutletId();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [grid, setGrid] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: api.productCategories });
  const products = useQuery({ queryKey: ['products', outletId, 'active'], queryFn: () => api.products(outletId, { active: true }), enabled: !!outletId });

  // Phones get two columns; tablets more.
  const columns = grid ? Math.max(2, Math.floor(width / 190)) : 1;
  const inCart = new Map(lines.flatMap((l) => (l.kind === 'product' ? [[l.productId, l.qty] as const] : [])));
  const visible = (products.data ?? []).filter(
    (p) => (!categoryId || p.categoryId === categoryId) && p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const usedCategories = (categories.data ?? []).filter((c) => products.data?.some((p) => p.categoryId === c.id));

  return (
    <View style={{ flex: 1 }}>
      <Toolbar
        filter={categoryId ? usedCategories.find((c) => c.id === categoryId)?.name : 'All Product'}
        actions={[
          { icon: 'search-outline', label: 'Cari produk', onPress: () => setSearching((s) => !s), active: searching },
          { icon: 'calculator-outline', label: 'Input manual', onPress: () => router.push('/pos/manual') },
          { icon: grid ? 'list-outline' : 'grid-outline', label: grid ? 'Tampilan daftar' : 'Tampilan grid', onPress: () => setGrid((g) => !g) },
        ]}
      />
      {searching ? (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Cari menu" style={styles.searchInput} placeholderTextColor={colors.muted} />
        </View>
      ) : null}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null, name: 'Semua' }, ...usedCategories].map((c) => (
            <Pressable key={c.id ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: categoryId === c.id }} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && styles.chipOn]}>
              <Text style={[styles.chipText, categoryId === c.id && { color: colors.white }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorView error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          key={columns}
          data={visible}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={columns > 1 ? { gap: space.md } : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => products.refetch()} />}
          ListEmptyComponent={<Empty title="Belum ada menu" body="Tambahkan produk di Produk & HPP." />}
          renderItem={({ item }) =>
            grid ? <ProductCard product={item} count={inCart.get(item.id)} onAdd={() => add(item)} /> : <ProductRow product={item} count={inCart.get(item.id)} onAdd={() => add(item)} />
          }
        />
      )}
      {lines.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Lihat keranjang" onPress={() => router.push('/pos/cart')} style={[styles.cartBar, { bottom: space.md + insets.bottom }]}>
          <Ionicons name="cart-outline" size={26} color={colors.white} />
          <Text style={styles.cartText}>{cartCount(lines)} Items</Text>
          <Text style={[styles.cartText, { marginLeft: 'auto' }]}>Total: {formatRupiah(cartTotal(lines))}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Main Menu': 'restaurant', 'Set Menu': 'fast-food', Snacks: 'pizza', Salad: 'leaf', Desserts: 'ice-cream', Drinks: 'cafe',
};

/** Product photo, or a category icon until the owner uploads one. */
function Photo({ product, style }: { product: Product; style: object }) {
  const uri = assetUrl(product.photoUrl);
  return uri ? (
    <Image source={{ uri }} style={style} contentFit="cover" />
  ) : (
    <View style={[style, styles.photoEmpty]}>
      <Ionicons name={CATEGORY_ICON[product.categoryName] ?? 'restaurant'} size={34} color={colors.primaryTint} />
    </View>
  );
}

function AddButton({ count, onPress, label }: { count?: number; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Tambah ${label}`} onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}>
      {count ? <Text style={styles.addCount}>{count}</Text> : <Ionicons name="add" size={22} color={colors.white} />}
    </Pressable>
  );
}

function ProductCard({ product, count, onAdd }: { product: Product; count?: number; onAdd: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.name}, ${formatRupiah(product.price)}`} onPress={onAdd} style={styles.card}>
      <Photo product={product} style={styles.cardPhoto} />
      <Text style={styles.cardName} numberOfLines={2}>
        {product.name}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatRupiah(product.price)}</Text>
        <AddButton count={count} onPress={onAdd} label={product.name} />
      </View>
    </Pressable>
  );
}

function ProductRow({ product, count, onAdd }: { product: Product; count?: number; onAdd: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onAdd} style={styles.row}>
      <Photo product={product} style={styles.rowPhoto} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName}>{product.name}</Text>
        <Text style={styles.price}>{formatRupiah(product.price)}</Text>
      </View>
      <AddButton count={count} onPress={onAdd} label={product.name} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 10, color: colors.ink },
  chips: { paddingHorizontal: space.md, paddingTop: space.sm + 4, gap: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryTint },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  list: { padding: space.md, gap: space.md },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: space.sm, gap: space.sm, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  cardPhoto: { width: '100%', aspectRatio: 1.6, borderRadius: radius.md },
  photoEmpty: { backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy, minHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  price: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  add: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addCount: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.md, padding: space.sm },
  rowPhoto: { width: 64, height: 52, borderRadius: radius.sm },
  cartBar: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cartText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
});
