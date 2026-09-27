import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COST_LINE_LABELS,
  isCompatible,
  saveProductSchema,
  toBase,
  type AccessClaims,
  type CostLine,
  type Product,
  type ProductCategory,
  type ProductDetail,
  type StockUnit,
} from '@organa/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { DB, type Db, type DbLike } from '../db/db.module.js';
import { costLines, ingredients, productCategories, products } from '../db/schema.js';
import { InventoryService } from '../inventory/inventory.service.js';

const DEFAULT_PRODUCT_CATEGORIES: [string, string][] = [
  ['Main Menu', 'restaurant-outline'],
  ['Set Menu', 'fast-food-outline'],
  ['Snacks', 'pizza-outline'],
  ['Salad', 'leaf-outline'],
  ['Desserts', 'ice-cream-outline'],
  ['Drinks', 'wine-outline'],
  ['Special Menu', 'star-outline'],
  ['Others', 'apps-outline'],
];

type SaveInput = z.output<typeof saveProductSchema>;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  async ensureDefaultCategories(tenantId: string, db: DbLike = this.db) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(productCategories).where(eq(productCategories.tenantId, tenantId));
    if (row!.n > 0) return;
    await db.insert(productCategories).values(DEFAULT_PRODUCT_CATEGORIES.map(([name, icon], sort) => ({ tenantId, name, icon, sort })));
  }

  async listCategories(tenantId: string): Promise<ProductCategory[]> {
    await this.ensureDefaultCategories(tenantId);
    const rows = await this.db
      .select({
        id: productCategories.id,
        name: productCategories.name,
        icon: productCategories.icon,
        // Qualified by hand: inside a select list Drizzle renders ${productCategories.id} as a bare "id".
        productCount: sql<number>`(select count(*)::int from products p where p.category_id = product_categories.id and p.active)`,
      })
      .from(productCategories)
      .where(eq(productCategories.tenantId, tenantId))
      .orderBy(asc(productCategories.sort), asc(productCategories.name));
    return rows;
  }

  async createCategory(tenantId: string, input: { name: string; icon: string }) {
    const [row] = await this.db.insert(productCategories).values({ tenantId, ...input, sort: 100 }).returning();
    return { id: row!.id, name: row!.name, icon: row!.icon, productCount: 0 };
  }

  /** Products with HPP computed from the outlet's current ingredient costs. */
  async listProducts(claims: AccessClaims, outletId: string, filter: { categoryId?: string; activeOnly?: boolean } = {}): Promise<Product[]> {
    const rows = await this.db
      .select({ p: products, categoryName: productCategories.name })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(
        and(
          eq(products.tenantId, claims.tid),
          filter.categoryId ? eq(products.categoryId, filter.categoryId) : undefined,
          filter.activeOnly ? eq(products.active, true) : undefined,
        ),
      )
      .orderBy(asc(productCategories.sort), asc(products.name));
    const lines = rows.length
      ? await this.db.select().from(costLines).where(inArray(costLines.productId, rows.map((r) => r.p.id)))
      : [];
    const costs = await this.inventory.ingredientCosts(outletId);
    return rows.map(({ p, categoryName }) => this.toProduct(p, categoryName, lines.filter((l) => l.productId === p.id), costs));
  }

  async getProduct(claims: AccessClaims, outletId: string, productId: string): Promise<ProductDetail> {
    const row = await this.db
      .select({ p: products, categoryName: productCategories.name })
      .from(products)
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(and(eq(products.id, productId), eq(products.tenantId, claims.tid)))
      .then((r) => r[0]);
    if (!row) throw new NotFoundException('Produk tidak ditemukan');
    const lines = await this.db.select().from(costLines).where(eq(costLines.productId, productId)).orderBy(asc(costLines.sort));
    const costs = await this.inventory.ingredientCosts(outletId);
    return {
      ...this.toProduct(row.p, row.categoryName, lines, costs),
      costLines: lines.map((l) => this.toCostLine(l, costs)),
    };
  }

  async saveProduct(claims: AccessClaims, outletId: string, input: SaveInput, productId?: string): Promise<ProductDetail> {
    const category = await this.db.query.productCategories.findFirst({
      where: and(eq(productCategories.id, input.categoryId), eq(productCategories.tenantId, claims.tid)),
    });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');

    const ingredientIds = input.costLines.flatMap((l) => (l.type === 'INGREDIENT' ? [l.ingredientId] : []));
    const ingRows = ingredientIds.length
      ? await this.db.select().from(ingredients).where(and(eq(ingredients.tenantId, claims.tid), inArray(ingredients.id, ingredientIds)))
      : [];
    const ingById = new Map(ingRows.map((i) => [i.id, i]));

    const id = await this.db.transaction(async (tx) => {
      let pid = productId;
      const values = { categoryId: input.categoryId, name: input.name, price: input.price, photoUrl: input.photoUrl ?? null, active: input.active };
      if (pid) {
        const [updated] = await tx.update(products).set(values).where(and(eq(products.id, pid), eq(products.tenantId, claims.tid))).returning();
        if (!updated) throw new NotFoundException('Produk tidak ditemukan');
        await tx.delete(costLines).where(eq(costLines.productId, pid));
      } else {
        const [created] = await tx.insert(products).values({ tenantId: claims.tid, ...values }).returning();
        pid = created!.id;
      }
      for (const [sort, line] of input.costLines.entries()) {
        if (line.type === 'INGREDIENT') {
          const ing = ingById.get(line.ingredientId);
          if (!ing) throw new BadRequestException('Bahan baku tidak ditemukan');
          if (!isCompatible(line.unit, ing.baseUnit)) throw new BadRequestException(`Satuan ${line.unit} tidak cocok dengan ${ing.name}`);
          await tx.insert(costLines).values({
            productId: pid, type: 'INGREDIENT', ingredientId: ing.id, label: ing.name, qty: line.qty, unit: line.unit,
            qtyBase: toBase(line.qty, line.unit as StockUnit), sort,
          });
        } else {
          await tx.insert(costLines).values({ productId: pid, type: line.type, label: line.label, qty: line.qty, unit: line.unit, value: line.value, sort });
        }
      }
      return pid;
    });
    return this.getProduct(claims, outletId, id);
  }

  /** Recipe (ingredient lines in base units) for a set of products, used by the POS. */
  async recipes(productIds: string[], db: DbLike = this.db) {
    if (!productIds.length) return new Map<string, { ingredientId: string; qtyBase: number }[]>();
    const rows = await db
      .select({ productId: costLines.productId, ingredientId: costLines.ingredientId, qtyBase: costLines.qtyBase })
      .from(costLines)
      .where(and(inArray(costLines.productId, productIds), eq(costLines.type, 'INGREDIENT')));
    const map = new Map<string, { ingredientId: string; qtyBase: number }[]>();
    for (const r of rows) {
      if (!r.ingredientId || r.qtyBase === null) continue;
      map.set(r.productId, [...(map.get(r.productId) ?? []), { ingredientId: r.ingredientId, qtyBase: r.qtyBase }]);
    }
    return map;
  }

  private toCostLine(l: typeof costLines.$inferSelect, costs: Map<string, number>): CostLine {
    const value = l.type === 'INGREDIENT' ? Math.round((l.qtyBase ?? 0) * (costs.get(l.ingredientId ?? '') ?? 0)) : (l.value ?? 0);
    return {
      id: l.id, type: l.type, ingredientId: l.ingredientId,
      label: l.type === 'INGREDIENT' ? l.label : l.label || COST_LINE_LABELS[l.type],
      qty: l.qty, unit: l.unit, value,
    };
  }

  private toProduct(p: typeof products.$inferSelect, categoryName: string, lines: (typeof costLines.$inferSelect)[], costs: Map<string, number>): Product {
    const hpp = lines.reduce((s, l) => s + this.toCostLine(l, costs).value, 0);
    const margin = p.price - hpp;
    return {
      id: p.id, categoryId: p.categoryId, categoryName, name: p.name, price: p.price, photoUrl: p.photoUrl, active: p.active,
      hpp, margin, marginRatio: p.price > 0 ? margin / p.price : 0,
    };
  }
}
