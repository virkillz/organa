import { Inject, Injectable } from '@nestjs/common';
import type { AccessClaims, Analysis, Dashboard, Forecast, ItemShare } from '@organa/shared';
import { sql } from 'drizzle-orm';
import { addDays, addMonths, jakartaDate, jakartaDayStart, jakartaMonth, periodRange } from '../common/time.js';
import { DB, type Db } from '../db/db.module.js';
import { ts } from '../common/time.js';
import { alerts, ingredients, orderLines, orders, stockMovements } from '../db/schema.js';
import { InventoryService } from '../inventory/inventory.service.js';

/** Movements that count as waste: expiry write-offs, manual waste, and stock-count shortages. */
const WASTE = sql`(m.type in ('EXPIRED', 'WASTE') or (m.type = 'ADJUST' and m.qty < 0))`;

type WasteRow = { ingredient_id: string; name: string; base_unit: 'gr' | 'ml' | 'pcs'; month: string; qty: number; value: number; events: number };

/** Forecast weights for the last three months, newest first. */
const WMA_WEIGHTS = [0.5, 0.3, 0.2];

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  /** Waste per ingredient per Jakarta month in [start, end). Values are positive rupiah. */
  private async wasteByMonth(outletId: string, start: Date, end: Date): Promise<WasteRow[]> {
    const rows = await this.db.execute<WasteRow>(sql`
      select m.ingredient_id, i.name, i.base_unit,
        to_char(m.occurred_at at time zone 'Asia/Jakarta', 'YYYY-MM') as month,
        (-sum(m.qty))::float8 as qty, (-sum(m.value))::float8 as value,
        count(distinct coalesce(m.batch_id::text, m.id::text))::int as events
      from ${stockMovements} m join ${ingredients} i on i.id = m.ingredient_id
      where m.outlet_id = ${outletId} and ${WASTE} and m.occurred_at >= ${ts(start)} and m.occurred_at < ${ts(end)}
      group by 1, 2, 3, 4`);
    return rows.map((r) => ({ ...r, qty: Number(r.qty), value: Number(r.value), events: Number(r.events) }));
  }

  private shares(rows: WasteRow[], limit = 5): ItemShare[] {
    const byItem = new Map<string, ItemShare>();
    for (const r of rows) {
      const cur = byItem.get(r.ingredient_id) ?? { ingredientId: r.ingredient_id, name: r.name, baseUnit: r.base_unit, qty: 0, value: 0, share: 0 };
      cur.qty += r.qty;
      cur.value += r.value;
      byItem.set(r.ingredient_id, cur);
    }
    const total = [...byItem.values()].reduce((s, i) => s + i.value, 0);
    return [...byItem.values()]
      .map((i) => ({ ...i, value: Math.round(i.value), qty: Math.round(i.qty), share: total > 0 ? i.value / total : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  async stockouts(outletId: string, start: Date, end: Date) {
    const rows = await this.db.execute<{ ingredient_id: string; name: string; count: number }>(sql`
      select a.ingredient_id, i.name, count(*)::int as count
      from ${alerts} a join ${ingredients} i on i.id = a.ingredient_id
      where a.outlet_id = ${outletId} and a.kind = 'STOCKOUT' and a.occurred_at >= ${ts(start)} and a.occurred_at < ${ts(end)}
      group by 1, 2 order by 3 desc`);
    return rows.map((r) => ({ ingredientId: r.ingredient_id, name: r.name, count: Number(r.count) }));
  }

  /** Waste analysis for a year (YYYY) or a month (YYYY-MM). */
  async analysis(outletId: string, period: string): Promise<Analysis> {
    const { start, end } = periodRange(period);
    const [rows, stockouts, years] = await Promise.all([
      this.wasteByMonth(outletId, start, end),
      this.stockouts(outletId, start, end),
      this.db.execute<{ y: number }>(sql`
        select distinct extract(year from occurred_at at time zone 'Asia/Jakarta')::int as y
        from ${stockMovements} where outlet_id = ${outletId} order by 1`),
    ]);
    const months = /^\d{4}$/.test(period)
      ? Array.from({ length: 12 }, (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`)
      : [period];
    const monthly = months.map((month) => {
      const inMonth = rows.filter((r) => r.month === month);
      return {
        month,
        wasteValue: Math.round(inMonth.reduce((s, r) => s + r.value, 0)),
        wasteEvents: inMonth.reduce((s, r) => s + r.events, 0),
      };
    });
    return {
      period,
      months: monthly,
      totalWasteValue: monthly.reduce((s, m) => s + m.wasteValue, 0),
      totalWasteEvents: monthly.reduce((s, m) => s + m.wasteEvents, 0),
      topItems: this.shares(rows),
      stockouts,
      availableYears: years.map((y) => Number(y.y)),
    };
  }

  /**
   * Forecast for a target month using a 3-month weighted moving average (0.5/0.3/0.2) of each
   * ingredient's waste, anchored on the last complete months before the target.
   */
  async forecast(claims: AccessClaims, outletId: string, month: string, at = new Date()): Promise<Forecast> {
    const current = jakartaMonth(at);
    // Use complete months only: the latest one before both the target and the current month.
    const lastComplete = addMonths(month <= current ? month : current, -1);
    const basis = [0, 1, 2].map((i) => addMonths(lastComplete, -i));
    const historyStart = addMonths(lastComplete, -5);
    const rows = await this.wasteByMonth(outletId, periodRange(historyStart).start, periodRange(lastComplete).end);

    const history = Array.from({ length: 6 }, (_, i) => addMonths(historyStart, i)).map((m) => ({
      month: m,
      wasteValue: Math.round(rows.filter((r) => r.month === m).reduce((s, r) => s + r.value, 0)),
    }));

    const perItem = new Map<string, { name: string; baseUnit: WasteRow['base_unit']; qty: number; value: number; events: number }>();
    for (const r of rows) {
      const w = WMA_WEIGHTS[basis.indexOf(r.month)];
      if (w === undefined) continue;
      const cur = perItem.get(r.ingredient_id) ?? { name: r.name, baseUnit: r.base_unit, qty: 0, value: 0, events: 0 };
      cur.qty += r.qty * w;
      cur.value += r.value * w;
      cur.events += r.events * w;
      perItem.set(r.ingredient_id, cur);
    }
    const total = [...perItem.values()].reduce((s, i) => s + i.value, 0);
    const items: ItemShare[] = [...perItem.entries()]
      .map(([ingredientId, i]) => ({ ingredientId, name: i.name, baseUnit: i.baseUnit, qty: Math.round(i.qty), value: Math.round(i.value), share: total ? i.value / total : 0 }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);

    // Buy less: the three biggest predicted wasters. Buy more: other ingredients that ran out at
    // least twice in the basis months, or have under 7 days of cover. Waste wins when both apply.
    const buyLess = items.slice(0, 3).map((i) => ({ ingredientId: i.ingredientId, name: i.name, reason: `Diprediksi terbuang ${i.qty} ${i.baseUnit}` }));
    const lessIds = new Set(buyLess.map((b) => b.ingredientId));
    const basisRange = { start: periodRange(basis[2]!).start, end: periodRange(basis[0]!).end };
    const outs = await this.stockouts(outletId, basisRange.start, basisRange.end);
    const cover = await this.daysOfCover(claims, outletId, at);
    const buyMore = new Map<string, { ingredientId: string; name: string; reason: string }>();
    for (const o of outs.filter((o) => o.count >= 2 && !lessIds.has(o.ingredientId))) {
      buyMore.set(o.ingredientId, { ingredientId: o.ingredientId, name: o.name, reason: `Habis ${o.count}x dalam 3 bulan terakhir` });
    }
    for (const c of cover.filter((c) => c.days < 7 && !lessIds.has(c.ingredientId))) {
      if (!buyMore.has(c.ingredientId)) {
        buyMore.set(c.ingredientId, { ingredientId: c.ingredientId, name: c.name, reason: `Stok cukup untuk ±${Math.max(0, Math.round(c.days))} hari` });
      }
    }

    return {
      month,
      history,
      predictedWasteValue: Math.round(total),
      predictedWasteEvents: Math.round([...perItem.values()].reduce((s, i) => s + i.events, 0)),
      items: items.slice(0, 5),
      buyMore: [...buyMore.values()].slice(0, 5),
      buyLess,
      method: 'Rata-rata bergerak tertimbang 3 bulan (50% / 30% / 20%)',
    };
  }

  /** Days until each stocked ingredient runs out at its average daily sales usage over 30 days. */
  private async daysOfCover(claims: AccessClaims, outletId: string, at: Date) {
    const since = new Date(at.getTime() - 30 * 86400_000);
    const usage = await this.db.execute<{ ingredient_id: string; used: number }>(sql`
      select ingredient_id, (-sum(qty))::float8 as used from ${stockMovements}
      where outlet_id = ${outletId} and type = 'SALE' and occurred_at >= ${ts(since)} and occurred_at < ${ts(at)}
      group by 1`);
    const daily = new Map(usage.map((u) => [u.ingredient_id, Number(u.used) / 30]));
    const levels = await this.inventory.stockLevels(claims, outletId, {}, at);
    return levels
      .filter((l) => (daily.get(l.ingredientId) ?? 0) > 0)
      .map((l) => ({ ingredientId: l.ingredientId, name: l.name, days: l.onHand / daily.get(l.ingredientId)! }));
  }

  async dashboard(claims: AccessClaims, outletId: string, at = new Date()): Promise<Dashboard> {
    const today = jakartaDate(at);
    const dayStart = jakartaDayStart(addDays(today, -6));
    const month = periodRange(jakartaMonth(at));
    const [sales, top, waste, summary] = await Promise.all([
      this.db.execute<{ d: string; total: number; n: number }>(sql`
        select to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as d, sum(total)::float8 as total, count(*)::int as n
        from ${orders} where outlet_id = ${outletId} and created_at >= ${ts(dayStart)} and created_at < ${ts(at)} group by 1`),
      this.db.execute<{ name: string; qty: number }>(sql`
        select l.name, sum(l.qty)::int as qty from ${orderLines} l join ${orders} o on o.id = l.order_id
        where o.outlet_id = ${outletId} and o.created_at >= ${ts(jakartaDayStart(today))} and o.created_at < ${ts(at)}
        group by 1 order by 2 desc limit 1`),
      this.wasteByMonth(outletId, month.start, month.end),
      this.inventory.summary(claims, outletId, at),
    ]);
    const byDay = new Map(sales.map((s) => [s.d, s]));
    const todayRow = byDay.get(today);
    return {
      salesToday: Math.round(Number(todayRow?.total ?? 0)),
      ordersToday: Number(todayRow?.n ?? 0),
      wasteThisMonth: Math.round(waste.reduce((s, r) => s + r.value, 0)),
      criticalCount: summary.criticalCount,
      expiringCount: summary.expiring.count,
      topProduct: top[0] ? { name: top[0].name, qty: Number(top[0].qty) } : null,
      salesLast7Days: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({ date: d, total: Math.round(Number(byDay.get(d)?.total ?? 0)) })),
    };
  }
}
