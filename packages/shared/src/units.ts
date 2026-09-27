import { z } from 'zod';

/** Stock is stored in base units: grams, millilitres or pieces. */
export const BASE_UNITS = ['gr', 'ml', 'pcs'] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];
export const baseUnitSchema = z.enum(BASE_UNITS);

export const STOCK_UNITS = ['gr', 'kg', 'ml', 'L', 'pcs'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];
export const stockUnitSchema = z.enum(STOCK_UNITS);

export const UNIT_INFO: Record<StockUnit, { base: BaseUnit; factor: number }> = {
  gr: { base: 'gr', factor: 1 },
  kg: { base: 'gr', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
  pcs: { base: 'pcs', factor: 1 },
};

/** Units a user can pick for a given base unit, e.g. gr → [gr, kg]. */
export function unitsFor(base: BaseUnit): StockUnit[] {
  return STOCK_UNITS.filter((u) => UNIT_INFO[u].base === base);
}

export function toBase(qty: number, unit: StockUnit): number {
  return qty * UNIT_INFO[unit].factor;
}

export function isCompatible(unit: StockUnit, base: BaseUnit): boolean {
  return UNIT_INFO[unit].base === base;
}

/** Shows a base quantity in the friendliest unit: 4000 gr stays "4000 gr" (as in the designs). */
export function formatQty(qty: number, base: BaseUnit): string {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded.toLocaleString('id-ID')} ${base}`;
}

export const STORAGE_TYPES = ['FREEZER', 'CHILLER', 'ROOM'] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];
export const storageTypeSchema = z.enum(STORAGE_TYPES);
export const STORAGE_INFO: Record<StorageType, { label: string; shelfLifeDays: number; hint: string }> = {
  FREEZER: { label: 'Freezer', shelfLifeDays: 180, hint: '6 bulan' },
  CHILLER: { label: 'Chiller', shelfLifeDays: 5, hint: '5 hari' },
  ROOM: { label: 'Suhu Ruang', shelfLifeDays: 30, hint: '30 hari' },
};
