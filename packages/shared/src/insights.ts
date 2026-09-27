import { z } from 'zod';
import { baseUnitSchema } from './units.js';

const id = z.string().uuid();

export const startCountSchema = z.object({ outletId: id, categoryId: id });
export type StartCountInput = z.infer<typeof startCountSchema>;

export const countLinesSchema = z.object({
  lines: z.array(z.object({ ingredientId: id, counted: z.number().min(0) })).min(1),
});
export type CountLinesInput = z.infer<typeof countLinesSchema>;

export const countLineSchema = z.object({
  ingredientId: id,
  name: z.string(),
  baseUnit: baseUnitSchema,
  expected: z.number(),
  counted: z.number().nullable(),
  /** counted − expected; negative is a shortage. */
  variance: z.number().nullable(),
  varianceValue: z.number().nullable(),
});
export type CountLine = z.infer<typeof countLineSchema>;

export const stockCountSchema = z.object({
  id,
  outletId: id,
  categoryId: id,
  categoryName: z.string(),
  status: z.enum(['OPEN', 'COMMITTED']),
  countedByName: z.string(),
  createdAt: z.string(),
  committedAt: z.string().nullable(),
  lines: z.array(countLineSchema),
  totalVarianceValue: z.number(),
});
export type StockCount = z.infer<typeof stockCountSchema>;

/** Waste = expired write-offs, manual waste, and stock-count shortages, valued at cost. */
export const itemShareSchema = z.object({
  ingredientId: id,
  name: z.string(),
  baseUnit: baseUnitSchema,
  qty: z.number(),
  value: z.number(),
  /** Share of total value, 0..1. */
  share: z.number(),
});
export type ItemShare = z.infer<typeof itemShareSchema>;

export const analysisSchema = z.object({
  period: z.string(),
  months: z.array(z.object({ month: z.string(), wasteValue: z.number(), wasteEvents: z.number() })),
  totalWasteValue: z.number(),
  totalWasteEvents: z.number(),
  topItems: z.array(itemShareSchema),
  stockouts: z.array(z.object({ ingredientId: id, name: z.string(), count: z.number() })),
  availableYears: z.array(z.number()),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const forecastSchema = z.object({
  month: z.string(),
  history: z.array(z.object({ month: z.string(), wasteValue: z.number() })),
  predictedWasteValue: z.number(),
  predictedWasteEvents: z.number(),
  items: z.array(itemShareSchema),
  buyMore: z.array(z.object({ ingredientId: id, name: z.string(), reason: z.string() })),
  buyLess: z.array(z.object({ ingredientId: id, name: z.string(), reason: z.string() })),
  method: z.string(),
});
export type Forecast = z.infer<typeof forecastSchema>;

export const insightSchema = z.object({
  kind: z.enum(['analysis', 'forecast']),
  period: z.string(),
  sections: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })),
  generatedAt: z.string(),
  source: z.enum(['claude', 'template']),
});
export type Insight = z.infer<typeof insightSchema>;

export const dashboardSchema = z.object({
  salesToday: z.number(),
  ordersToday: z.number(),
  wasteThisMonth: z.number(),
  criticalCount: z.number(),
  expiringCount: z.number(),
  topProduct: z.object({ name: z.string(), qty: z.number() }).nullable(),
  salesLast7Days: z.array(z.object({ date: z.string(), total: z.number() })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const notificationSchema = z.object({
  id,
  kind: z.enum(['CRITICAL', 'STOCKOUT', 'EXPIRING', 'EXPIRED']),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof notificationSchema>;
