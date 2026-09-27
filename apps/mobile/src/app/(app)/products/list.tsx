import Ionicons from '@expo/vector-icons/Ionicons';
import { formatPercent, formatRupiah, type Product } from '@organa/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Empty, ErrorView, Fab, Loading, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api, assetUrl } from '@/lib/api';
import { useOutletId } from '@/lib/hooks';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function ProductList() {
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const outletId = useOutletId();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(!categoryId);
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: api.productCategories });
  const products = useQuery({ queryKey: ['products', outletId, categoryId], queryFn: () => api.products(outletId, { categoryId }), enabled: !!outletId });
  const category = categories.data?.find((c) => c.id === categoryId);
  const rows = (products.data ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Manajemen Produk' }} />
      <Toolbar filter={category ? category.name : 'All Product'} actions={[{ icon: 'search-outline', label: 'Cari', onPress: () => setSearching((s) => !s), active: searching }]} />
      {searching ? (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Cari produk" style={styles.searchInput} placeholderTextColor={colors.muted} />
        </View>
      ) : null}
      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <ErrorView error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => products.refetch()} />}
          ListHeaderComponent={category ? <Text style={styles.heading}>KATEGORI PRODUK: {category.name.toUpperCase()}</Text> : null}
          ListEmptyComponent={<Empty title="Belum ada produk" body="Tambahkan produk dan resepnya lewat tombol Input Produk." />}
          renderItem={({ item }) => <ProductRow product={item} />}
          ListFooterComponent={
            <View style={{ alignItems: 'flex-end', marginTop: space.md }}>
              <Fab label="INPUT PRODUK" onPress={() => router.push({ pathname: '/products/edit', params: { categoryId } })} />
            </View>
          }
        />
      )}
    </View>
  );
}

function ProductRow({ product: p }: { product: Product }) {
  const photo = assetUrl(p.photoUrl);
  return (
    <View style={styles.row}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons name="restaurant-outline" size={30} color={colors.primaryTint} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2, paddingVertical: space.sm }}>
        <Text style={styles.name} numberOfLines={2}>
          {p.name}
        </Text>
        <Text style={styles.price}>{formatRupiah(p.price)}</Text>
        <Text style={styles.hpp}>
          HPP {formatRupiah(p.hpp)} · Margin {formatPercent(p.marginRatio)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${p.name}`}
        onPress={() => router.push({ pathname: '/products/edit', params: { id: p.id } })}
        style={styles.edit}>
        <Ionicons name="create-outline" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, paddingHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 10, color: colors.ink },
  list: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 17, color: colors.navy, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.lg, paddingRight: space.md, overflow: 'hidden' },
  photo: { width: 96, height: 80 },
  photoEmpty: { backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.navy },
  price: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  hpp: { fontSize: 11, color: colors.muted },
  edit: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
