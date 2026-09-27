import { router } from 'expo-router';
import { StockCategoryGrid } from '@/components/stock-category-grid';

export default function PickCountCategory() {
  return <StockCategoryGrid onPick={(categoryId) => router.push({ pathname: '/stock-count/[categoryId]', params: { categoryId } })} />;
}
