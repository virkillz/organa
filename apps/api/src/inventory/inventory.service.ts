import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EXPIRY_WINDOW_DAYS,
  isCompatible,
  STORAGE_INFO,
  toBase,
  UNIT_INFO,
  type AccessClaims,
  type Batch,
  type ExpiryRow,
  type IngredientDetail,
  type StockCategory,
  type StockInInput,
  type StockItem,
  type StockStatus,
  type StockSummary,
  type UpdateIngredientInput,
  stockInSchema,
} from '@organa/shared';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { addDays, jakartaDate, jakartaMonth, periodRange } from '../common/time.js';
import { DB, type Db, type DbLike } from '../db/db.module.js';
import { alerts, ingredients, stockBatches, stockCategories, stockMovements } from '../db/schema.js';

type MovementType = 'SALE' | 'WASTE' | 'ADJUST';
export type RaisedAlert = { ingredientId: string; name: string; kind: 'CRITICAL' | 'STOCKOUT' };

const DEFAULT_STOCK_CATEGORIES: { name: string; icon: string; children?: string[] }[] = [
  { name: 'Sayuran', icon: 'leaf-outline' },
  { name: 'Daging', icon: 'restaurant-outline', children: ['Daging Ayam', 'Daging Sapi'] },
  { name: 'Seafood', icon: 'fish-outline' },
  { name: 'Buah', icon: 'nutrition-outline' },
  { name: 'Bumbu & Rempah', icon: 'flask-outline' },
  { name: 'Tepung', icon: 'cube-outline' },
  { name: 'Minyak & Lemak', icon: 'water-outline' },
  { name: 'Produk Susu', icon: 'pint-outline' },
  { name: 'Kacang-kacangan', icon: 'ellipse-outline' },
  { name: 'Minuman', icon: 'cafe-outline' },
  { name: 'Lainnya', icon: 'apps-outline' },
];

/** Rounds money to whole rupiah. */
const rp = (n: number) => Math.round(n);

@Injectable()
export class InventoryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ---------- categories ----------

  async listCategories(tenantId: string): Promise<StockCategory[]> {
    await this.ensureDefaultCategories(tenantId);
    return this.db
      .select({ id: stockCategories.id, name: stockCategories.name, icon: stockCategories.icon, parentId: stockCategories.parentId })
      .from(stockCategories)
      .where(eq(stockCategories.tenantId, tenantId))
      .orderBy(asc(stockCategories.sort), asc(stockCategories.name));
  }

  async createCategory(tenantId: string, input: { name: string; icon: string; parentId?: string }): Promise<StockCategory> {
    if (input.parentId) await this.assertCategory(tenantId, input.parentId);
    const [row] = await this.db
      .insert(stockCategories)
      .values({ tenantId, name: input.name, icon: input.icon, parentId: input.parentId, sort: 100 })
      .returning();
    return { id: row!.id, name: row!.name, icon: row!.icon, parentId: row!.parentId };
  }

  /** Seeds the default stock categories the first time a tenant needs them. */
  async ensureDefaultCategories(tenantId: string, db: DbLike = this.db): Promise<void> {
    const [existing] = await db.select({ n: sql<number>`count(*)::int` }).from(stockCategories).where(eq(stockCategories.tenantId, tenantId));
    if (existing!.n > 0) return;
    for (const [i, cat] of DEFAULT_STOCK_CATEGORIES.entries()) {
      const [parent] = await db.insert(stockCategories).values({ tenantId, name: cat.name, icon: cat.icon, sort: i }).returning();
      for (const [j, child] of (cat.children ?? []).entries()) {
        await db.insert(stockCategories).values({ tenantId, name: child, icon: cat.icon, parentId: parent!.id, sort: j });
      }
    }
  }

  /** The category and its sub-categories. */
  private async categoryTree(tenantId: string, categoryId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: stockCategories.id })
      .from(stockCategories)
      .where(and(eq(stockCategories.tenantId, tenantId), eq(stockCategories.parentId, categoryId)));
    return [categoryId, ...rows.map((r) => r.id)];
  }

  private async assertCategory(tenantId: string, categoryId: string) {
    const cat = await this.db.query.stockCategories.findFirst({
      where: and(eq(stockCategories.id, categoryId), eq(stockCategories.tenantId, tenantId)),
    });
    if (!cat) throw new NotFoundException('Kategori tidak ditemukan');
    return cat;
  }

  // ---------- stock in ----------

  async stockIn(claims: AccessClaims, raw: StockInInput, at = new Date(), db: DbLike = this.db) {
    const input = stockInSchema.parse(raw) as z.output<typeof stockInSchema>;
    return db.transaction(async (tx) => {
      let ingredient = input.ingredientId
        ? await tx.query.ingredients.findFirst({
            where: and(eq(ingredients.id, input.ingredientId), eq(ingredients.tenantId, claims.tid)),
          })
        : await tx.query.ingredients.findFirst({
            where: and(eq(ingredients.tenantId, claims.tid), eq(ingredients.name, input.name!)),
          });

      const base = UNIT_INFO[input.unit].base;
      if (!ingredient) {
        if (!input.categoryId || !input.name) throw new NotFoundException('Bahan tidak ditemukan');
        await this.assertCategory(claims.tid, input.categoryId);
        [ingredient] = await tx
          .insert(ingredients)
          .values({
            tenantId: claims.tid,
            categoryId: input.categoryId,
            name: input.name,
            baseUnit: base,
            criticalQty: input.criticalQty !== undefined ? toBase(input.criticalQty, input.criticalUnit ?? input.unit) : 0,
            defaultStorage: input.storage,
          })
          .returning();
      } else if (input.criticalQty !== undefined) {
        await tx
          .update(ingredients)
          .set({ criticalQty: toBase(input.criticalQty, input.criticalUnit ?? input.unit) })
          .where(eq(ingredients.id, ingredient.id));
      }
      const ing = ingredient!;
      if (!isCompatible(input.unit, ing.baseUnit) || !isCompatible(input.priceUnit, ing.baseUnit)) {
        throw new BadRequestException(`Satuan tidak cocok dengan ${ing.name} (${ing.baseUnit})`);
      }

      const qtyBase = toBase(input.qty, input.unit);
      const unitCost = input.price / UNIT_INFO[input.priceUnit].factor;
      const [batch] = await tx
        .insert(stockBatches)
        .values({
          tenantId: claims.tid,
          outletId: input.outletId,
          ingredientId: ing.id,
          qtyInitial: qtyBase,
          qtyRemaining: qtyBase,
          unitCost,
          storage: input.storage,
          expiryDate: input.expiryDate,
          receivedAt: at,
          createdByName: claims.name,
        })
        .returning();
      await tx.insert(stockMovements).values({
        tenantId: claims.tid,
        outletId: input.outletId,
        ingredientId: ing.id,
        batchId: batch!.id,
        type: 'IN',
        qty: qtyBase,
        unitCost,
        value: rp(qtyBase * unitCost),
        refType: 'stock_in',
        refId: batch!.id,
        occurredAt: at,
        createdByName: claims.name,
      });
      return { ingredientId: ing.id, batchId: batch!.id };
    });
  }

  // ---------- consumption (FEFO) ----------

  /**
   * Takes `qty` (base units) out of stock, first-expiring batch first, and writes one movement
   * per batch touched. A shortfall is still recorded (stock goes negative) at the last known cost:
   * a sale is never blocked by the system's idea of stock.
   */
  async consume(
    tx: DbLike,
    p: { tenantId: string; outletId: string; ingredientId: string; qty: number; type: MovementType; refType: string; refId: string; at: Date; by: string },
  ): Promise<{ value: number; alerts: RaisedAlert[] }> {
    const before = await this.onHand(tx, p.outletId, p.ingredientId);
    const batches = await tx
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.outletId, p.outletId), eq(stockBatches.ingredientId, p.ingredientId), gt(stockBatches.qtyRemaining, 0), isNull(stockBatches.expiredAt)))
      .orderBy(asc(stockBatches.expiryDate), asc(stockBatches.receivedAt));

    let left = p.qty;
    let value = 0;
    let lastCost = batches.at(-1)?.unitCost ?? (await this.lastCost(tx, p.outletId, p.ingredientId));
    for (const b of batches) {
      if (left <= 1e-9) break;
      const take = Math.min(left, b.qtyRemaining);
      await tx.update(stockBatches).set({ qtyRemaining: b.qtyRemaining - take }).where(eq(stockBatches.id, b.id));
      await tx.insert(stockMovements).values({
        tenantId: p.tenantId, outletId: p.outletId, ingredientId: p.ingredientId, batchId: b.id, type: p.type,
        qty: -take, unitCost: b.unitCost, value: -rp(take * b.unitCost), refType: p.refType, refId: p.refId,
        occurredAt: p.at, createdByName: p.by,
      });
      value += take * b.unitCost;
      left -= take;
      lastCost = b.unitCost;
    }
    if (left > 1e-9) {
      await tx.insert(stockMovements).values({
        tenantId: p.tenantId, outletId: p.outletId, ingredientId: p.ingredientId, batchId: null, type: p.type,
        qty: -left, unitCost: lastCost, value: -rp(left * lastCost), refType: p.refType, refId: p.refId,
        occurredAt: p.at, createdByName: p.by,
      });
      value += left * lastCost;
    }
    const raised = await this.raiseThresholdAlerts(tx, p, before, before - p.qty);
    return { value: rp(value), alerts: raised };
  }

  /** Adds stock found in a count: tops up the newest open batch, or opens one at the last cost. */
  async addAdjustment(
    tx: DbLike,
    p: { tenantId: string; outletId: string; ingredientId: string; qty: number; refId: string; at: Date; by: string },
  ): Promise<void> {
    const [latest] = await tx
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.outletId, p.outletId), eq(stockBatches.ingredientId, p.ingredientId), isNull(stockBatches.expiredAt)))
      .orderBy(desc(stockBatches.receivedAt))
      .limit(1);
    const cost = latest?.unitCost ?? (await this.lastCost(tx, p.outletId, p.ingredientId));
    let batchId = latest?.id ?? null;
    if (latest) {
      await tx.update(stockBatches).set({ qtyRemaining: latest.qtyRemaining + p.qty }).where(eq(stockBatches.id, latest.id));
    } else {
      const ing = await tx.query.ingredients.findFirst({ where: eq(ingredients.id, p.ingredientId) });
      const storage = ing?.defaultStorage ?? 'CHILLER';
      const [b] = await tx
        .insert(stockBatches)
        .values({
          tenantId: p.tenantId, outletId: p.outletId, ingredientId: p.ingredientId, qtyInitial: p.qty, qtyRemaining: p.qty,
          unitCost: cost, storage, expiryDate: addDays(jakartaDate(p.at), STORAGE_INFO[storage].shelfLifeDays),
          receivedAt: p.at, createdByName: p.by,
        })
        .returning();
      batchId = b!.id;
    }
    await tx.insert(stockMovements).values({
      tenantId: p.tenantId, outletId: p.outletId, ingredientId: p.ingredientId, batchId, type: 'ADJUST',
      qty: p.qty, unitCost: cost, value: rp(p.qty * cost), refType: 'stock_count', refId: p.refId,
      occurredAt: p.at, createdByName: p.by,
    });
  }

  private async raiseThresholdAlerts(
    tx: DbLike,
    p: { tenantId: string; outletId: string; ingredientId: string; at: Date },
    before: number,
    after: number,
  ): Promise<RaisedAlert[]> {
    const ing = await tx.query.ingredients.findFirst({ where: eq(ingredients.id, p.ingredientId) });
    if (!ing) return [];
    const raised: RaisedAlert[] = [];
    if (before > 0 && after <= 0) {
      raised.push({ ingredientId: ing.id, name: ing.name, kind: 'STOCKOUT' });
    } else if (ing.criticalQty > 0 && before > ing.criticalQty && after <= ing.criticalQty) {
      raised.push({ ingredientId: ing.id, name: ing.name, kind: 'CRITICAL' });
    }
    for (const a of raised) {
      if (a.kind === 'CRITICAL' && !ing.criticalAlert) continue;
      await tx.insert(alerts).values({
        tenantId: p.tenantId, outletId: p.outletId, ingredientId: ing.id, kind: a.kind, occurredAt: p.at,
        title: a.kind === 'STOCKOUT' ? `${ing.name} habis` : `${ing.name} mencapai stok kritis`,
        body:
          a.kind === 'STOCKOUT'
            ? `Stok ${ing.name} sudah habis. Segera lakukan pembelian.`
            : `Sisa ${Math.max(0, Math.round(after))} ${ing.baseUnit}, batas kritis ${Math.round(ing.criticalQty)} ${ing.baseUnit}.`,
      });
    }
    return raised;
  }

  // ---------- expiry ----------

  /** Writes off every batch whose expiry date has passed (Jakarta date of `at`). Idempotent. */
  async expirySweep(at = new Date(), outletId?: string, db: DbLike = this.db): Promise<number> {
    const today = jakartaDate(at);
    const due = await db
      .select({ batch: stockBatches, name: ingredients.name, expiryAlert: ingredients.expiryAlert })
      .from(stockBatches)
      .innerJoin(ingredients, eq(ingredients.id, stockBatches.ingredientId))
      .where(
        and(
          isNull(stockBatches.expiredAt),
          gt(stockBatches.qtyRemaining, 0),
          lt(stockBatches.expiryDate, today),
          outletId ? eq(stockBatches.outletId, outletId) : undefined,
        ),
      );
    for (const { batch: b, name, expiryAlert } of due) {
      await db.transaction(async (tx) => {
        const when = at;
        await tx.update(stockBatches).set({ qtyRemaining: 0, expiredAt: when }).where(eq(stockBatches.id, b.id));
        await tx.insert(stockMovements).values({
          tenantId: b.tenantId, outletId: b.outletId, ingredientId: b.ingredientId, batchId: b.id, type: 'EXPIRED',
          qty: -b.qtyRemaining, unitCost: b.unitCost, value: -rp(b.qtyRemaining * b.unitCost), refType: 'expiry',
          refId: b.id, occurredAt: when, createdByName: 'Sistem',
        });
        if (expiryAlert) {
          await tx.insert(alerts).values({
            tenantId: b.tenantId, outletId: b.outletId, ingredientId: b.ingredientId, kind: 'EXPIRED', occurredAt: when,
            title: `${name} kedaluwarsa`,
            body: `${Math.round(b.qtyRemaining)} gr senilai Rp${rp(b.qtyRemaining * b.unitCost).toLocaleString('id-ID')} dihapus dari stok.`,
          });
        }
      });
    }
    return due.length;
  }

  // ---------- reads ----------

  async onHand(db: DbLike, outletId: string, ingredientId: string): Promise<number> {
    const [row] = await db
      .select({ q: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::float8` })
      .from(stockMovements)
      .where(and(eq(stockMovements.outletId, outletId), eq(stockMovements.ingredientId, ingredientId)));
    return row!.q;
  }

  private async lastCost(db: DbLike, outletId: string, ingredientId: string): Promise<number> {
    const [row] = await db
      .select({ c: stockBatches.unitCost })
      .from(stockBatches)
      .where(and(eq(stockBatches.outletId, outletId), eq(stockBatches.ingredientId, ingredientId)))
      .orderBy(desc(stockBatches.receivedAt))
      .limit(1);
    return row?.c ?? 0;
  }

  /**
   * Average cost per base unit for each ingredient in an outlet: weighted by the remaining batch
   * quantities, else the latest purchase cost. Used for stock value, HPP and variance value.
   */
  async ingredientCosts(outletId: string, db: DbLike = this.db): Promise<Map<string, number>> {
    const rows = await db.execute<{ ingredient_id: string; cost: number }>(sql`
      select ingredient_id,
        coalesce(
          sum(qty_remaining * unit_cost) filter (where qty_remaining > 0 and expired_at is null)
            / nullif(sum(qty_remaining) filter (where qty_remaining > 0 and expired_at is null), 0),
          (array_agg(unit_cost order by received_at desc))[1]
        )::float8 as cost
      from ${stockBatches}
      where outlet_id = ${outletId}
      group by ingredient_id`);
    return new Map(rows.map((r) => [r.ingredient_id, Number(r.cost)]));
  }

  async stockLevels(claims: AccessClaims, outletId: string, filter: { categoryId?: string; status?: StockStatus } = {}, at = new Date()): Promise<StockItem[]> {
    const today = jakartaDate(at);
    const categoryIds = filter.categoryId ? await this.categoryTree(claims.tid, filter.categoryId) : undefined;
    const rows = await this.db.execute<{
      id: string; category_id: string; name: string; base_unit: 'gr' | 'ml' | 'pcs'; critical_qty: number;
      on_hand: number; next_expiry: string | null; last_input_at: string | null;
    }>(sql`
      select i.id, i.category_id, i.name, i.base_unit, i.critical_qty,
        coalesce((select sum(m.qty) from ${stockMovements} m where m.outlet_id = ${outletId} and m.ingredient_id = i.id), 0)::float8 as on_hand,
        (select min(b.expiry_date)::text from ${stockBatches} b where b.outlet_id = ${outletId} and b.ingredient_id = i.id and b.qty_remaining > 0 and b.expired_at is null) as next_expiry,
        (select max(b.received_at) from ${stockBatches} b where b.outlet_id = ${outletId} and b.ingredient_id = i.id) as last_input_at
      from ${ingredients} i
      where i.tenant_id = ${claims.tid}
        ${categoryIds ? sql`and i.category_id in ${categoryIds}` : sql``}
        and exists (select 1 from ${stockMovements} m where m.outlet_id = ${outletId} and m.ingredient_id = i.id)
      order by last_input_at desc nulls last, i.name`);
    const costs = await this.ingredientCosts(outletId);
    const soon = addDays(today, EXPIRY_WINDOW_DAYS);
    const items = rows.map((r): StockItem => {
      const avgCost = costs.get(r.id) ?? 0;
      const onHand = Number(r.on_hand);
      const status: StockStatus =
        r.next_expiry && r.next_expiry < today
          ? 'expired'
          : onHand <= Number(r.critical_qty)
            ? 'critical'
            : r.next_expiry && r.next_expiry <= soon
              ? 'expiring'
              : 'ok';
      return {
        ingredientId: r.id,
        categoryId: r.category_id,
        name: r.name,
        baseUnit: r.base_unit,
        onHand,
        value: rp(Math.max(0, onHand) * avgCost),
        avgCost,
        criticalQty: Number(r.critical_qty),
        nextExpiry: r.next_expiry,
        lastInputAt: r.last_input_at ? new Date(r.last_input_at).toISOString() : null,
        status,
      };
    });
    return filter.status ? items.filter((i) => i.status === filter.status) : items;
  }

  async summary(claims: AccessClaims, outletId: string, at = new Date()): Promise<StockSummary> {
    const [levels, expiring, expired, cats] = await Promise.all([
      this.stockLevels(claims, outletId, {}, at),
      this.expiringRows(outletId, at),
      this.expiredRows(outletId, at),
      this.listCategories(claims.tid),
    ]);
    const parentOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
    const expiringIngredients = new Set(expiring.map((e) => e.ingredientId));
    const topLevel = cats.filter((c) => !c.parentId);
    return {
      expiring: { count: expiring.length, value: expiring.reduce((s, r) => s + r.value, 0) },
      expired: { count: expired.length, value: expired.reduce((s, r) => s + r.value, 0) },
      criticalCount: levels.filter((l) => l.status === 'critical').length,
      categories: topLevel.map((c) => {
        const inCat = levels.filter((l) => parentOf.get(l.categoryId) === c.id);
        return {
          ...c,
          itemCount: inCat.length,
          criticalCount: inCat.filter((l) => l.status === 'critical').length,
          expiringCount: inCat.filter((l) => expiringIngredients.has(l.ingredientId)).length,
        };
      }),
    };
  }

  /** Open batches expiring today .. today + window. */
  async expiringRows(outletId: string, at = new Date()): Promise<ExpiryRow[]> {
    const today = jakartaDate(at);
    const rows = await this.db
      .select({ b: stockBatches, name: ingredients.name, baseUnit: ingredients.baseUnit })
      .from(stockBatches)
      .innerJoin(ingredients, eq(ingredients.id, stockBatches.ingredientId))
      .where(
        and(
          eq(stockBatches.outletId, outletId),
          isNull(stockBatches.expiredAt),
          gt(stockBatches.qtyRemaining, 0),
          gte(stockBatches.expiryDate, today),
          sql`${stockBatches.expiryDate} <= ${addDays(today, EXPIRY_WINDOW_DAYS)}`,
        ),
      )
      .orderBy(asc(stockBatches.expiryDate));
    return rows.map(({ b, name, baseUnit }) => ({
      batchId: b.id, ingredientId: b.ingredientId, name, baseUnit, qty: b.qtyRemaining,
      value: rp(b.qtyRemaining * b.unitCost), expiryDate: b.expiryDate,
    }));
  }

  /** Batches written off by the expiry sweep this month. */
  async expiredRows(outletId: string, at = new Date()): Promise<ExpiryRow[]> {
    const { start, end } = periodRange(jakartaMonth(at));
    const rows = await this.db
      .select({ m: stockMovements, name: ingredients.name, baseUnit: ingredients.baseUnit, expiryDate: stockBatches.expiryDate })
      .from(stockMovements)
      .innerJoin(ingredients, eq(ingredients.id, stockMovements.ingredientId))
      .innerJoin(stockBatches, eq(stockBatches.id, stockMovements.batchId))
      .where(and(eq(stockMovements.outletId, outletId), eq(stockMovements.type, 'EXPIRED'), gte(stockMovements.occurredAt, start), lt(stockMovements.occurredAt, end)))
      .orderBy(desc(stockBatches.expiryDate));
    return rows.map(({ m, name, baseUnit, expiryDate }) => ({
      batchId: m.batchId!, ingredientId: m.ingredientId, name, baseUnit, qty: -m.qty, value: -m.value, expiryDate,
    }));
  }

  async ingredientDetail(claims: AccessClaims, outletId: string, ingredientId: string, at = new Date()): Promise<IngredientDetail> {
    const ing = await this.db.query.ingredients.findFirst({ where: and(eq(ingredients.id, ingredientId), eq(ingredients.tenantId, claims.tid)) });
    if (!ing) throw new NotFoundException('Bahan tidak ditemukan');
    const cat = await this.assertCategory(claims.tid, ing.categoryId);
    const parent = cat.parentId ? await this.assertCategory(claims.tid, cat.parentId) : null;
    const levels = await this.stockLevels(claims, outletId, {}, at);
    const today = jakartaDate(at);
    const stock =
      levels.find((l) => l.ingredientId === ingredientId) ??
      ({
        ingredientId, categoryId: ing.categoryId, name: ing.name, baseUnit: ing.baseUnit, onHand: 0, value: 0, avgCost: 0,
        criticalQty: ing.criticalQty, nextExpiry: null, lastInputAt: null, status: 'critical',
      } satisfies StockItem);
    const batches = await this.db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.outletId, outletId), eq(stockBatches.ingredientId, ingredientId), gt(stockBatches.qtyRemaining, 0), isNull(stockBatches.expiredAt)))
      .orderBy(asc(stockBatches.expiryDate));
    return {
      id: ing.id, categoryId: ing.categoryId, name: ing.name, baseUnit: ing.baseUnit, criticalQty: ing.criticalQty,
      defaultStorage: ing.defaultStorage, expiryAlert: ing.expiryAlert, criticalAlert: ing.criticalAlert,
      categoryName: cat.name, parentCategoryName: parent?.name ?? null, stock,
      batches: batches.map(
        (b): Batch => ({
          id: b.id, qtyInitial: b.qtyInitial, qtyRemaining: b.qtyRemaining, unitCost: b.unitCost,
          value: rp(b.qtyRemaining * b.unitCost), receivedAt: b.receivedAt.toISOString(), expiryDate: b.expiryDate,
          storage: b.storage, createdByName: b.createdByName,
          status: b.expiryDate < today ? 'expired' : b.expiryDate <= addDays(today, EXPIRY_WINDOW_DAYS) ? 'expiring' : 'ok',
        }),
      ),
    };
  }

  async listIngredients(tenantId: string, categoryId?: string) {
    const ids = categoryId ? await this.categoryTree(tenantId, categoryId) : undefined;
    return this.db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.tenantId, tenantId), ids ? inArray(ingredients.categoryId, ids) : undefined))
      .orderBy(asc(ingredients.name));
  }

  async updateIngredient(claims: AccessClaims, ingredientId: string, input: UpdateIngredientInput) {
    const ing = await this.db.query.ingredients.findFirst({ where: and(eq(ingredients.id, ingredientId), eq(ingredients.tenantId, claims.tid)) });
    if (!ing) throw new NotFoundException('Bahan tidak ditemukan');
    const { criticalQty, criticalUnit, ...rest } = input;
    if (criticalUnit && !isCompatible(criticalUnit, ing.baseUnit)) throw new BadRequestException('Satuan tidak cocok');
    const [row] = await this.db
      .update(ingredients)
      .set({ ...rest, ...(criticalQty !== undefined ? { criticalQty: toBase(criticalQty, criticalUnit ?? ing.baseUnit) } : {}) })
      .where(eq(ingredients.id, ingredientId))
      .returning();
    return row!;
  }

  async listAlerts(outletId: string, since?: Date) {
    return this.db
      .select({ id: alerts.id, kind: alerts.kind, title: alerts.title, body: alerts.body, createdAt: alerts.occurredAt })
      .from(alerts)
      .where(and(eq(alerts.outletId, outletId), since ? gt(alerts.occurredAt, since) : undefined))
      .orderBy(desc(alerts.occurredAt))
      .limit(50);
  }
}

