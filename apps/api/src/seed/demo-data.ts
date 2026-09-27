import type { BaseUnit, StorageType } from '@organa/shared';

/**
 * Demo catalogue for "SteakWarung_JKT". Prices are rupiah per base unit (gr / ml / pcs).
 * `overbuy` > 1 plants waste (stock expires), < 1 plants stock-outs.
 */
export type DemoIngredient = {
  name: string;
  category: string;
  base: BaseUnit;
  price: number;
  storage: StorageType;
  shelfLifeDays: number;
  critical: number;
  overbuy: number;
  /** Per-outlet override for the planted stories. */
  overbuyCabang2?: number;
};

export const DEMO_INGREDIENTS: DemoIngredient[] = [
  { name: 'Beef Sirloin Lokal', category: 'Daging Sapi', base: 'gr', price: 250, storage: 'CHILLER', shelfLifeDays: 5, critical: 1500, overbuy: 0.9 },
  { name: 'Beef Tenderloin Lokal', category: 'Daging Sapi', base: 'gr', price: 280, storage: 'CHILLER', shelfLifeDays: 4, critical: 800, overbuy: 2.3, overbuyCabang2: 1.1 },
  { name: 'Beef Wagyu Brisket', category: 'Daging Sapi', base: 'gr', price: 800, storage: 'FREEZER', shelfLifeDays: 120, critical: 600, overbuy: 1.05 },
  { name: 'Paha Ayam Fillet', category: 'Daging Ayam', base: 'gr', price: 35, storage: 'CHILLER', shelfLifeDays: 4, critical: 2000, overbuy: 0.92 },
  { name: 'Dada Ayam Fillet', category: 'Daging Ayam', base: 'gr', price: 38, storage: 'CHILLER', shelfLifeDays: 4, critical: 1500, overbuy: 1.05, overbuyCabang2: 1.25 },
  { name: 'Sayap Ayam', category: 'Daging Ayam', base: 'gr', price: 30, storage: 'FREEZER', shelfLifeDays: 60, critical: 2000, overbuy: 1.05 },
  { name: 'Kulit Ayam', category: 'Daging Ayam', base: 'gr', price: 20, storage: 'CHILLER', shelfLifeDays: 3, critical: 500, overbuy: 1.6 },
  { name: 'Salmon Fillet', category: 'Seafood', base: 'gr', price: 350, storage: 'CHILLER', shelfLifeDays: 3, critical: 600, overbuy: 1.05, overbuyCabang2: 1.4 },
  { name: 'Tuna Steak', category: 'Seafood', base: 'gr', price: 180, storage: 'CHILLER', shelfLifeDays: 3, critical: 600, overbuy: 1.05 },
  { name: 'Kentang', category: 'Sayuran', base: 'gr', price: 18, storage: 'ROOM', shelfLifeDays: 21, critical: 3000, overbuy: 1.05 },
  { name: 'Selada', category: 'Sayuran', base: 'gr', price: 30, storage: 'CHILLER', shelfLifeDays: 5, critical: 500, overbuy: 1.05 },
  { name: 'Tomat Mini', category: 'Sayuran', base: 'gr', price: 35, storage: 'CHILLER', shelfLifeDays: 5, critical: 400, overbuy: 1.4 },
  { name: 'Sayur Mix', category: 'Sayuran', base: 'gr', price: 25, storage: 'CHILLER', shelfLifeDays: 5, critical: 800, overbuy: 1.05 },
  { name: 'Lemon', category: 'Buah', base: 'gr', price: 40, storage: 'CHILLER', shelfLifeDays: 14, critical: 300, overbuy: 1.05 },
  { name: 'Bumbu Steak', category: 'Bumbu & Rempah', base: 'gr', price: 100, storage: 'ROOM', shelfLifeDays: 90, critical: 500, overbuy: 1.05 },
  { name: 'Tepung Bumbu', category: 'Tepung', base: 'gr', price: 15, storage: 'ROOM', shelfLifeDays: 120, critical: 1000, overbuy: 1.05 },
  { name: 'Minyak Goreng', category: 'Minyak & Lemak', base: 'ml', price: 20, storage: 'ROOM', shelfLifeDays: 180, critical: 2000, overbuy: 1.05 },
  { name: 'Mentega', category: 'Minyak & Lemak', base: 'gr', price: 120, storage: 'CHILLER', shelfLifeDays: 30, critical: 300, overbuy: 1.05 },
  { name: 'Keju Parmesan', category: 'Produk Susu', base: 'gr', price: 300, storage: 'CHILLER', shelfLifeDays: 30, critical: 200, overbuy: 1.05 },
  { name: 'Susu Segar', category: 'Produk Susu', base: 'ml', price: 22, storage: 'CHILLER', shelfLifeDays: 6, critical: 1000, overbuy: 1.05 },
  { name: 'Es Krim Vanilla', category: 'Produk Susu', base: 'ml', price: 60, storage: 'FREEZER', shelfLifeDays: 90, critical: 1000, overbuy: 1.05 },
  { name: 'Teh Celup', category: 'Minuman', base: 'pcs', price: 500, storage: 'ROOM', shelfLifeDays: 365, critical: 30, overbuy: 1.05 },
  { name: 'Milo Bubuk', category: 'Minuman', base: 'gr', price: 150, storage: 'ROOM', shelfLifeDays: 180, critical: 500, overbuy: 0.95 },
  { name: 'Soft Drink', category: 'Minuman', base: 'pcs', price: 6000, storage: 'ROOM', shelfLifeDays: 180, critical: 24, overbuy: 1.05 },
  { name: 'Frozen Fries', category: 'Lainnya', base: 'gr', price: 40, storage: 'FREEZER', shelfLifeDays: 120, critical: 3000, overbuy: 1.05 },
];

export type DemoProduct = {
  name: string;
  category: string;
  price: number;
  /** Relative popularity for the order generator. */
  weight: number;
  recipe: [ingredient: string, qty: number][];
  labour?: number;
  overhead?: number;
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  { name: 'Sirloin Steak', category: 'Main Menu', price: 120000, weight: 10, recipe: [['Beef Sirloin Lokal', 200], ['Bumbu Steak', 20], ['Kentang', 150], ['Mentega', 10]], labour: 10000, overhead: 1500 },
  { name: 'Tenderloin Steak', category: 'Main Menu', price: 110000, weight: 5, recipe: [['Beef Tenderloin Lokal', 180], ['Bumbu Steak', 20], ['Kentang', 150], ['Mentega', 10]], labour: 10000, overhead: 1500 },
  { name: 'Wagyu Brisket', category: 'Main Menu', price: 150000, weight: 3, recipe: [['Beef Wagyu Brisket', 150], ['Bumbu Steak', 20], ['Sayur Mix', 80]], labour: 10000, overhead: 1500 },
  { name: 'Chicken Steak', category: 'Main Menu', price: 55000, weight: 9, recipe: [['Paha Ayam Fillet', 200], ['Tepung Bumbu', 50], ['Minyak Goreng', 30], ['Kentang', 150]], labour: 6000, overhead: 1000 },
  { name: 'Steak Tuna', category: 'Main Menu', price: 80000, weight: 3, recipe: [['Tuna Steak', 180], ['Sayur Mix', 80], ['Lemon', 20]], labour: 8000, overhead: 1000 },
  { name: 'Salmon Grill', category: 'Main Menu', price: 95000, weight: 3, recipe: [['Salmon Fillet', 180], ['Sayur Mix', 80], ['Mentega', 10], ['Lemon', 20]], labour: 8000, overhead: 1000 },
  { name: 'Tenderloin Family Package', category: 'Set Menu', price: 250000, weight: 1, recipe: [['Beef Tenderloin Lokal', 400], ['Kentang', 300], ['Bumbu Steak', 40], ['Soft Drink', 2]], labour: 15000, overhead: 3000 },
  { name: 'French Fries', category: 'Snacks', price: 25000, weight: 8, recipe: [['Frozen Fries', 150], ['Minyak Goreng', 30]], labour: 2000, overhead: 500 },
  { name: 'Chicken Wings', category: 'Snacks', price: 35000, weight: 5, recipe: [['Sayap Ayam', 250], ['Tepung Bumbu', 40], ['Minyak Goreng', 40]], labour: 3000, overhead: 500 },
  { name: 'Chicken Skin Crispy', category: 'Snacks', price: 20000, weight: 2, recipe: [['Kulit Ayam', 150], ['Tepung Bumbu', 30], ['Minyak Goreng', 30]], labour: 2000, overhead: 500 },
  { name: 'Sate Yakitori', category: 'Snacks', price: 50000, weight: 4, recipe: [['Dada Ayam Fillet', 180], ['Bumbu Steak', 15]], labour: 5000, overhead: 800 },
  { name: 'Caesar Salad', category: 'Salad', price: 25000, weight: 4, recipe: [['Selada', 80], ['Tomat Mini', 40], ['Keju Parmesan', 20], ['Dada Ayam Fillet', 50]], labour: 2000, overhead: 300 },
  { name: 'Garden Salad', category: 'Salad', price: 20000, weight: 2, recipe: [['Selada', 100], ['Tomat Mini', 60]], labour: 2000, overhead: 300 },
  { name: 'Es Krim Vanilla', category: 'Desserts', price: 20000, weight: 3, recipe: [['Es Krim Vanilla', 100]], labour: 1000, overhead: 200 },
  { name: 'Es Teh Manis', category: 'Drinks', price: 8000, weight: 10, recipe: [['Teh Celup', 1]], labour: 500, overhead: 200 },
  { name: 'Lemon Tea', category: 'Drinks', price: 15000, weight: 4, recipe: [['Teh Celup', 1], ['Lemon', 30]], labour: 500, overhead: 200 },
  { name: 'Milo Dingin', category: 'Drinks', price: 18000, weight: 6, recipe: [['Milo Bubuk', 30], ['Susu Segar', 100]], labour: 500, overhead: 200 },
  { name: 'Soft Drink', category: 'Drinks', price: 15000, weight: 5, recipe: [['Soft Drink', 1]] },
];

export const DEMO_OWNER = { fullName: 'Elvin Eka', email: 'demo@organa.id', password: 'organa123' };

export const DEMO_OUTLETS = [
  {
    name: 'Cabang 1',
    address: 'Arcade Business Center Lt. 6, Jl. Pantai Indah Utara 2, Jakarta Utara',
    ordersPerDay: 26,
    employees: [
      { name: 'Marcell', role: 'HEAD_CHEF' as const, pin: '123456' },
      { name: 'Abdul', role: 'CASHIER' as const, pin: '654321' },
    ],
  },
  {
    name: 'Cabang 2',
    address: 'Jl. Kemang Raya 12, Jakarta Selatan',
    ordersPerDay: 20,
    employees: [
      { name: 'Sari', role: 'HEAD_CHEF' as const, pin: '111111' },
      { name: 'Budi', role: 'CASHIER' as const, pin: '222222' },
    ],
  },
];
