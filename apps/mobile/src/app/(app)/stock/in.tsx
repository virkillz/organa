import { router, Stack } from 'expo-router';
import { StockCategoryGrid } from '@/components/stock-category-grid';

export default function PickStockInCategory() {
  return (
    <>
      <Stack.Screen options={{ title: 'Input Stok' }} />
      <StockCategoryGrid allowAdd onPick={(categoryId) => router.push({ pathname: '/stock/in-form', params: { categoryId } })} />
    </>
  );
}

