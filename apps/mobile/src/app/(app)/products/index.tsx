import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ErrorView, Fab, Loading, Tile, TileGrid, Toolbar } from '@/components/ui/kit';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { colors, fonts, space } from '@/theme/tokens';

export default function ProductCategories() {
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: api.productCategories });

  const addCategory = () => router.push('/products/new-category');

  return (
    <View style={{ flex: 1 }}>
      <Toolbar filter="All Product" actions={[{ icon: 'search-outline', label: 'Cari produk', onPress: () => router.push('/products/list') }]} />
      {categories.isPending ? (
        <Loading />
      ) : categories.isError ? (
        <ErrorView error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={categories.isRefetching} onRefresh={() => categories.refetch()} />}>
          <Text style={styles.heading}>PILIH KATEGORI PRODUK</Text>
          <TileGrid>
            {categories.data.map((c) => (
              <Tile key={c.id} icon={c.icon as never} label={c.name} badge={c.productCount || undefined} onPress={() => router.push({ pathname: '/products/list', params: { categoryId: c.id } })} />
            ))}
            <Tile icon="add" label="Tambah Kategori" dashed onPress={addCategory} />
          </TileGrid>
          <View style={{ alignItems: 'flex-end' }}>
            <Fab label="INPUT PRODUK" onPress={() => router.push('/products/edit')} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xl * 2 },
  heading: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 18, color: colors.navy },
});
