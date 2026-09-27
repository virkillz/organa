import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessClaims, CreateOrderInput, Order } from '@organa/shared';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { CatalogService } from '../catalog/catalog.service.js';
import { jakartaDate, jakartaDayStart, addDays } from '../common/time.js';
import { DB, type Db, type DbLike } from '../db/db.module.js';
import { orderLines, orders, payments, products } from '../db/schema.js';
import {
  InventoryService,
  type RaisedAlert,
} from '../inventory/inventory.service.js';

@Injectable()
export class PosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  /**
   * Records a paid order and deducts every recipe ingredient (FEFO) in one transaction.
   * Idempotent on `clientId`: a retry returns the original order.
   */
  async createOrder(
    claims: AccessClaims,
    input: CreateOrderInput,
    at = new Date(),
    db: DbLike = this.db,
  ): Promise<Order> {
    const existing = await db.query.orders.findFirst({
      where: and(
        eq(orders.tenantId, claims.tid),
        eq(orders.clientId, input.clientId),
      ),
    });
    if (existing) return this.getOrder(claims, existing.id, [], db);

    const productIds = input.lines.flatMap((l) =>
      'productId' in l ? [l.productId] : [],
    );
    const productRows = productIds.length
      ? await db
          .select()
          .from(products)
          .where(
            and(
              eq(products.tenantId, claims.tid),
              inArray(products.id, productIds),
            ),
          )
      : [];
    const byId = new Map(productRows.map((p) => [p.id, p]));
    const lines = input.lines.map((l) => {
      if ('productId' in l) {
        const p = byId.get(l.productId);
        if (!p || !p.active)
          throw new NotFoundException(
            'Produk tidak ditemukan atau tidak aktif',
          );
        return {
          productId: p.id,
          name: p.name,
          qty: l.qty,
          unitPrice: p.price,
          lineTotal: p.price * l.qty,
        };
      }
      return {
        productId: null,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.unitPrice * l.qty,
      };
    });
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const itemCount = lines.reduce((s, l) => s + l.qty, 0);
    const cash = input.payment.method === 'CASH';
    const tendered = cash ? input.payment.tendered! : total;
    if (tendered < total)
      throw new BadRequestException('Uang tunai kurang dari total tagihan');

    const recipes = await this.catalog.recipes(productIds, db);
    const raised: RaisedAlert[] = [];

    let orderId: string;
    try {
      orderId = await db.transaction(async (tx) => {
        const today = jakartaDate(at);
        const [seq] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(orders)
          .where(
            and(
              eq(orders.outletId, input.outletId),
              gte(orders.createdAt, jakartaDayStart(today)),
              lt(orders.createdAt, jakartaDayStart(addDays(today, 1))),
            ),
          );
        const number = `${today.slice(8, 10)}${today.slice(5, 7)}-${String(seq!.n + 1).padStart(4, '0')}`;
        const [order] = await tx
          .insert(orders)
          .values({
            tenantId: claims.tid,
            outletId: input.outletId,
            clientId: input.clientId,
            number,
            subtotal: total,
            total,
            itemCount,
            cashierName: claims.name,
            createdAt: at,
          })
          .returning();
        await tx
          .insert(orderLines)
          .values(lines.map((l) => ({ ...l, orderId: order!.id })));
        await tx.insert(payments).values({
          orderId: order!.id,
          method: input.payment.method,
          amount: total,
          tendered,
          change: tendered - total,
          simulated: !cash,
        });

        // Sum per ingredient first so one ingredient used by several lines is deducted once.
        const usage = new Map<string, number>();
        for (const l of lines) {
          for (const r of (l.productId && recipes.get(l.productId)) || [])
            usage.set(
              r.ingredientId,
              (usage.get(r.ingredientId) ?? 0) + r.qtyBase * l.qty,
            );
        }
        for (const [ingredientId, qty] of usage) {
          const res = await this.inventory.consume(tx, {
            tenantId: claims.tid,
            outletId: input.outletId,
            ingredientId,
            qty,
            type: 'SALE',
            refType: 'order',
            refId: order!.id,
            at,
            by: claims.name,
          });
          raised.push(...res.alerts);
        }
        return order!.id;
      });
    } catch (e) {
      // A concurrent retry with the same clientId won the race: return that order.
      if (!isUniqueViolation(e)) throw e;
      const winner = await db.query.orders.findFirst({
        where: and(
          eq(orders.tenantId, claims.tid),
          eq(orders.clientId, input.clientId),
        ),
      });
      if (!winner) throw e;
      return this.getOrder(claims, winner.id, [], db);
    }
    return this.getOrder(claims, orderId, raised, db);
  }

  async getOrder(
    claims: AccessClaims,
    orderId: string,
    raised: RaisedAlert[] = [],
    db: DbLike = this.db,
  ): Promise<Order> {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.tenantId, claims.tid)),
    });
    if (!order) throw new NotFoundException('Transaksi tidak ditemukan');
    const [lines, [payment]] = await Promise.all([
      db.select().from(orderLines).where(eq(orderLines.orderId, orderId)),
      db.select().from(payments).where(eq(payments.orderId, orderId)),
    ]);
    return {
      id: order.id,
      clientId: order.clientId,
      number: order.number,
      total: order.total,
      itemCount: order.itemCount,
      method: payment!.method,
      tendered: payment!.tendered,
      change: payment!.change,
      simulated: payment!.simulated,
      createdAt: order.createdAt.toISOString(),
      cashierName: order.cashierName,
      lines: lines.map((l) => ({
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      alerts: raised,
    };
  }

  async listOrders(
    claims: AccessClaims,
    outletId: string,
    date = jakartaDate(),
  ) {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          gte(orders.createdAt, jakartaDayStart(date)),
          lt(orders.createdAt, jakartaDayStart(addDays(date, 1))),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(200);
    return Promise.all(rows.map((r) => this.getOrder(claims, r.id)));
  }
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
}
