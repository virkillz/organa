import { z } from 'zod';
import { stockUnitSchema } from './units.js';

const id = z.string().uuid();

export const COST_LINE_TYPES = ['INGREDIENT', 'LABOUR', 'OVERHEAD', 'OTHER'] as const;
export type CostLineType = (typeof COST_LINE_TYPES)[number];
export const COST_LINE_LABELS: Record<CostLineType, string> = {
  INGREDIENT: 'Bahan Baku',
  LABOUR: 'Tenaga Kerja Langsung',
  OVERHEAD: 'Overhead Produksi',
  OTHER: 'Biaya Lainnya',
};
/** Units for non-ingredient cost lines (people, pieces). */
export const MANUAL_COST_UNITS = ['org', 'pcs', 'jam'] as const;

export const productCategorySchema = z.object({ id, name: z.string(), icon: z.string(), productCount: z.number() });
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  icon: z.string().max(40).default('restaurant-outline'),
});
export type CreateProductCategoryInput = z.input<typeof createProductCategorySchema>;

export const costLineInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INGREDIENT'),
    ingredientId: id,
    qty: z.number().positive('Jumlah harus lebih dari 0'),
    unit: stockUnitSchema,
  }),
  z.object({
    type: z.enum(['LABOUR', 'OVERHEAD', 'OTHER']),
    label: z.string().trim().min(2, 'Isi keterangan').max(60),
    qty: z.number().positive('Jumlah harus lebih dari 0'),
    unit: z.string().max(10),
    /** Line total in rupiah, entered by hand. */
    value: z.number().int().min(0),
  }),
]);
export type CostLineInput = z.infer<typeof costLineInputSchema>;

export const saveProductSchema = z.object({
  categoryId: id,
  name: z.string().trim().min(2, 'Nama produk terlalu pendek').max(80),
  price: z.number().int().min(0, 'Harga tidak valid'),
  photoUrl: z.string().max(500).nullable().optional(),
  active: z.boolean().default(true),
  costLines: z.array(costLineInputSchema).max(30),
});
export type SaveProductInput = z.input<typeof saveProductSchema>;

export const costLineSchema = z.object({
  id,
  type: z.enum(COST_LINE_TYPES),
  ingredientId: id.nullable(),
  label: z.string(),
  qty: z.number(),
  unit: z.string(),
  /** Computed for ingredient lines from the outlet's average cost; stored for manual lines. */
  value: z.number(),
});
export type CostLine = z.infer<typeof costLineSchema>;

export const productSchema = z.object({
  id,
  categoryId: id,
  categoryName: z.string(),
  name: z.string(),
  price: z.number(),
  photoUrl: z.string().nullable(),
  active: z.boolean(),
  hpp: z.number(),
  margin: z.number(),
  marginRatio: z.number(),
});
export type Product = z.infer<typeof productSchema>;

export const productDetailSchema = productSchema.extend({ costLines: z.array(costLineSchema) });
export type ProductDetail = z.infer<typeof productDetailSchema>;
