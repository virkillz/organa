import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessClaims, CountLinesInput, StockCount } from '@organa/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, type Db, type DbLike } from '../db/db.module.js';
import { ingredients, stockCategories, stockCountLines, stockCounts } from '../db/schema.js';
import { InventoryService } from '../inventory/inventory.service.js';

@Injectable()
export class CountsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  /**
   * Opens a count for a category (and its sub-categories), snapshotting expected stock
   * and cost. Reuses an open count for the same outlet and category.
   */
  async start(claims: AccessClaims, outletId: string, categoryId: string, at = new Date(), db: DbLike = this.db): Promise<StockCount> {
    const category = await db.query.stockCategories.findFirst({ where: and(eq(stockCategories.id, categoryId), eq(stockCategories.tenantId, claims.tid)) });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');
    const open = await db.query.stockCounts.findFirst({
      where: and(eq(stockCounts.outletId, outletId), eq(stockCounts.categoryId, categoryId), eq(stockCounts.status, 'OPEN')),
    });
    if (open) {
      await this.refreshExpected(open.id, outletId, db);
      return this.get(claims, open.id, db);
    }
    const children = await db.select({ id: stockCategories.id }).from(stockCategories).where(eq(stockCategories.parentId, categoryId));
    const catIds = [categoryId, ...children.map((c) => c.id)];
    const ings = await db.select().from(ingredients).where(and(eq(ingredients.tenantId, claims.tid), inArray(ingredients.categoryId, catIds)));
    const [count] = await db
      .insert(stockCounts)
      .values({ tenantId: claims.tid, outletId, categoryId, countedByName: claims.name, createdAt: at })
      .returning();
    const costs = await this.inventory.ingredientCosts(outletId, db);
    for (const ing of ings) {
      const expected = await this.inventory.onHand(db, outletId, ing.id);
      // Only ingredients this outlet has ever stocked.
      if (expected === 0 && !costs.has(ing.id)) continue;
      await db.insert(stockCountLines).values({ countId: count!.id, ingredientId: ing.id, expected, unitCost: costs.get(ing.id) ?? 0 });
    }
    return this.get(claims, count!.id, db);
  }

  async saveLines(claims: AccessClaims, countId: string, input: CountLinesInput, db: DbLike = this.db): Promise<StockCount> {
    const count = await this.find(claims, countId, db);
    if (count.status !== 'OPEN') throw new BadRequestException('Stok opname sudah disimpan');
    for (const line of input.lines) {
      await db
        .update(stockCountLines)
        .set({ counted: line.counted })
        .where(and(eq(stockCountLines.countId, countId), eq(stockCountLines.ingredientId, line.ingredientId)));
    }
    return this.get(claims, countId, db);
  }

  /** Posts the differences as ADJUST movements, so on-hand stock equals the physical count. */
  async commit(claims: AccessClaims, countId: string, at = new Date(), db: DbLike = this.db): Promise<StockCount> {
    const count = await this.find(claims, countId, db);
    if (count.status !== 'OPEN') throw new BadRequestException('Stok opname sudah disimpan');
    await db.transaction(async (tx) => {
      // Sales may have happened since the count opened; compare against stock right now.
      await this.refreshExpected(countId, count.outletId, tx);
      const lines = await tx.select().from(stockCountLines).where(eq(stockCountLines.countId, countId));
      for (const line of lines) {
        if (line.counted === null) continue;
        const diff = line.counted - line.expected;
        if (Math.abs(diff) < 1e-9) continue;
        const base = { tenantId: claims.tid, outletId: count.outletId, ingredientId: line.ingredientId, at, by: claims.name };
        if (diff < 0) {
          await this.inventory.consume(tx, { ...base, qty: -diff, type: 'ADJUST', refType: 'stock_count', refId: countId });
        } else {
          await this.inventory.addAdjustment(tx, { ...base, qty: diff, refId: countId });
        }
      }
      await tx.update(stockCounts).set({ status: 'COMMITTED', committedAt: at, countedByName: claims.name }).where(eq(stockCounts.id, countId));
    });
    return this.get(claims, countId, db);
  }

  /** The most recent count (open or committed) that has at least one counted line. */
  async latest(claims: AccessClaims, outletId: string, categoryId?: string): Promise<StockCount | null> {
    const row = await this.db.query.stockCounts.findFirst({
      where: and(
        eq(stockCounts.tenantId, claims.tid),
        eq(stockCounts.outletId, outletId),
        categoryId ? eq(stockCounts.categoryId, categoryId) : undefined,
        sql`exists (select 1 from stock_count_lines l where l.count_id = ${stockCounts.id} and l.counted is not null)`,
      ),
      orderBy: desc(stockCounts.createdAt),
    });
    return row ? this.get(claims, row.id) : null;
  }

  async get(claims: AccessClaims, countId: string, db: DbLike = this.db): Promise<StockCount> {
    const count = await this.find(claims, countId, db);
    const category = await db.query.stockCategories.findFirst({ where: eq(stockCategories.id, count.categoryId) });
    const lines = await db
      .select({ l: stockCountLines, name: ingredients.name, baseUnit: ingredients.baseUnit })
      .from(stockCountLines)
      .innerJoin(ingredients, eq(ingredients.id, stockCountLines.ingredientId))
      .where(eq(stockCountLines.countId, countId))
      .orderBy(ingredients.name);
    const mapped = lines.map(({ l, name, baseUnit }) => {
      const variance = l.counted === null ? null : l.counted - l.expected;
      return {
        ingredientId: l.ingredientId, name, baseUnit, expected: l.expected, counted: l.counted, variance,
        varianceValue: variance === null ? null : Math.round(variance * l.unitCost),
      };
    });
    return {
      id: count.id, outletId: count.outletId, categoryId: count.categoryId, categoryName: category?.name ?? '',
      status: count.status, countedByName: count.countedByName, createdAt: count.createdAt.toISOString(),
      committedAt: count.committedAt?.toISOString() ?? null, lines: mapped,
      totalVarianceValue: mapped.reduce((s, l) => s + (l.varianceValue ?? 0), 0),
    };
  }

  private async refreshExpected(countId: string, outletId: string, db: DbLike) {
    const lines = await db.select().from(stockCountLines).where(eq(stockCountLines.countId, countId));
    for (const l of lines) {
      const expected = await this.inventory.onHand(db, outletId, l.ingredientId);
      if (expected !== l.expected) await db.update(stockCountLines).set({ expected }).where(eq(stockCountLines.id, l.id));
    }
  }

  private async find(claims: AccessClaims, countId: string, db: DbLike) {
    const count = await db.query.stockCounts.findFirst({ where: and(eq(stockCounts.id, countId), eq(stockCounts.tenantId, claims.tid)) });
    if (!count) throw new NotFoundException('Stok opname tidak ditemukan');
    if (claims.oid && claims.oid !== count.outletId) throw new NotFoundException('Stok opname tidak ditemukan');
    return count;
  }
}
