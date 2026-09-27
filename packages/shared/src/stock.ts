import { z } from 'zod';
import { baseUnitSchema, stockUnitSchema, storageTypeSchema } from './units.js';

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD');

/** Items expiring within this many days count as "potential expiry". */
export const EXPIRY_WINDOW_DAYS = 3;

export const stockCategorySchema = z.object({
  id,
  name: z.string(),
  icon: z.string(),
  parentId: id.nullable(),
});
export type StockCategory = z.infer<typeof stockCategorySchema>;

export const createStockCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().max(40).default('cube-outline'),
  parentId: id.optional(),
});
export type CreateStockCategoryInput = z.input<typeof createStockCategorySchema>;

export const ingredientSchema = z.object({
  id,
  categoryId: id,
  name: z.string(),
  baseUnit: baseUnitSchema,
  criticalQty: z.number(),
  defaultStorage: storageTypeSchema,
  expiryAlert: z.boolean(),
  criticalAlert: z.boolean(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const updateIngredientSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  criticalQty: z.number().min(0).optional(),
  criticalUnit: stockUnitSchema.optional(),
  defaultStorage: storageTypeSchema.optional(),
  expiryAlert: z.boolean().optional(),
  criticalAlert: z.boolean().optional(),
});
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;

/** Stock-in: either an existing ingredient, or a new one created from `name` + `categoryId`. */
export const stockInSchema = z
  .object({
    outletId: id,
    ingredientId: id.optional(),
    categoryId: id.optional(),
    name: z.string().trim().min(2, 'Nama bahan terlalu pendek').max(80).optional(),
    qty: z.number().positive('Jumlah harus lebih dari 0'),
    unit: stockUnitSchema,
    /** Price in rupiah per `priceUnit`, e.g. Rp 35.000 per kg. */
    price: z.number().int().min(0),
    priceUnit: stockUnitSchema,
    criticalQty: z.number().min(0).optional(),
    criticalUnit: stockUnitSchema.optional(),
    storage: storageTypeSchema,
    expiryDate: isoDate,
  })
  .refine((v) => v.ingredientId || (v.name && v.categoryId), {
    message: 'Pilih bahan atau isi nama dan kategori',
    path: ['name'],
  });
export type StockInInput = z.input<typeof stockInSchema>;

export const STOCK_STATUSES = ['ok', 'critical', 'expiring', 'expired'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** One ingredient's stock in one outlet. Money is integer rupiah. */
export const stockItemSchema = z.object({
  ingredientId: id,
  categoryId: id,
  name: z.string(),
  baseUnit: baseUnitSchema,
  onHand: z.number(),
  value: z.number(),
  avgCost: z.number(),
  criticalQty: z.number(),
  nextExpiry: isoDate.nullable(),
  lastInputAt: z.string().nullable(),
  status: z.enum(STOCK_STATUSES),
});
export type StockItem = z.infer<typeof stockItemSchema>;

export const batchSchema = z.object({
  id,
  qtyInitial: z.number(),
  qtyRemaining: z.number(),
  unitCost: z.number(),
  value: z.number(),
  receivedAt: z.string(),
  expiryDate: isoDate,
  storage: storageTypeSchema,
  createdByName: z.string(),
  status: z.enum(['ok', 'expiring', 'expired']),
});
export type Batch = z.infer<typeof batchSchema>;

export const ingredientDetailSchema = ingredientSchema.extend({
  categoryName: z.string(),
  parentCategoryName: z.string().nullable(),
  stock: stockItemSchema,
  batches: z.array(batchSchema),
});
export type IngredientDetail = z.infer<typeof ingredientDetailSchema>;

/** A batch shown on the expiring / expired lists. */
export const expiryRowSchema = z.object({
  batchId: id,
  ingredientId: id,
  name: z.string(),
  baseUnit: baseUnitSchema,
  qty: z.number(),
  value: z.number(),
  expiryDate: isoDate,
});
export type ExpiryRow = z.infer<typeof expiryRowSchema>;

export const stockSummarySchema = z.object({
  expiring: z.object({ count: z.number(), value: z.number() }),
  expired: z.object({ count: z.number(), value: z.number() }),
  criticalCount: z.number(),
  categories: z.array(
    stockCategorySchema.extend({
      itemCount: z.number(),
      criticalCount: z.number(),
      expiringCount: z.number(),
    }),
  ),
});
export type StockSummary = z.infer<typeof stockSummarySchema>;
