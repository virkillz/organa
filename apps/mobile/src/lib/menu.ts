import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Role } from '@organa/shared';

export type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles: readonly Role[];
};

const ALL: readonly Role[] = ['OWNER', 'HEAD_CHEF', 'CASHIER'];
const BACK_OFFICE: readonly Role[] = ['OWNER', 'HEAD_CHEF'];
const CASHIER: readonly Role[] = ['OWNER', 'CASHIER'];

/** Drawer entries in display order; each route is a screen under src/app/(app). */
export const MENU: readonly MenuItem[] = [
  { route: 'dashboard', label: 'Dashboard', icon: 'grid-outline', roles: ['OWNER'] },
  { route: 'products', label: 'Produk & HPP', icon: 'restaurant-outline', roles: BACK_OFFICE },
  { route: 'stock', label: 'Manajemen Stok', icon: 'cube-outline', roles: BACK_OFFICE },
  { route: 'analysis', label: 'Analisis Stok', icon: 'search-outline', roles: BACK_OFFICE },
  { route: 'stock-count', label: 'Stok Opname', icon: 'swap-horizontal-outline', roles: BACK_OFFICE },
  { route: 'comparison', label: 'Stok Pintar vs Stok Nyata', icon: 'git-compare-outline', roles: BACK_OFFICE },
  { route: 'forecast', label: 'Prediksi Stok', icon: 'trending-up-outline', roles: BACK_OFFICE },
  { route: 'pos', label: 'Kasir', icon: 'cart-outline', roles: CASHIER },
  { route: 'transactions', label: 'Riwayat Transaksi', icon: 'receipt-outline', roles: CASHIER },
  { route: 'reports', label: 'Laporan', icon: 'document-text-outline', roles: CASHIER },
  { route: 'tables', label: 'Manajemen Meja', icon: 'tablet-landscape-outline', roles: ['CASHIER'] },
  { route: 'targets', label: 'Target', icon: 'flag-outline', roles: ['CASHIER'] },
  { route: 'employees', label: 'Karyawan', icon: 'people-outline', roles: ['OWNER'] },
  { route: 'support', label: 'Support', icon: 'help-buoy-outline', roles: ALL },
];

export function menuFor(role: Role): MenuItem[] {
  return MENU.filter((m) => m.roles.includes(role));
}

export function homeRouteFor(role: Role): string {
  return role === 'OWNER' ? 'dashboard' : role === 'CASHIER' ? 'pos' : 'stock';
}
