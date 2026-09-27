/**
 * Rebuilds the demo tenant with 180 days of history for two outlets.
 *
 *   pnpm --filter @organa/api seed:demo            # uses DATABASE_URL from .env
 *   pnpm --filter @organa/api seed:demo -- --days 90
 *
 * History is replayed through the same services the app uses (stock-in, POS, counts, expiry
 * sweep), so every number on every screen agrees. Dates are anchored to "now": the history
 * ends at the current time, whenever the demo runs. The random seed is fixed.
 */
import { NestFactory } from '@nestjs/core';
import type { AccessClaims, Employee, EmployeeRole } from '@organa/shared';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { addDays, addMonths, jakartaDate, jakartaDayStart, jakartaMonth } from '../common/time.js';
import { loadConfig } from '../config.js';
import { CountsService } from '../counts/counts.service.js';
import { DB, type Db } from '../db/db.module.js';
import { stockCategories, tenants, users } from '../db/schema.js';
import { InsightsService } from '../insights/insights.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PosService } from '../pos/pos.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import { DEMO_INGREDIENTS, DEMO_OUTLETS, DEMO_OWNER, DEMO_PRODUCTS } from './demo-data.js';
import { isEntrypoint } from '../common/entrypoint.js';

const RESTOCK_EVERY_DAYS = 3;

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An instant at hh:mm Jakarta time on a Jakarta date. */
const at = (date: string, hour: number, minute = 0) => new Date(jakartaDayStart(date).getTime() + (hour * 60 + minute) * 60_000);

export async function seedDemo(days = 180, log: (msg: string) => void = console.log) {
  const config = loadConfig();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: ['error', 'warn'] });
  const db = app.get<Db>(DB);
  const auth = app.get(AuthService);
  const tenantSvc = app.get(TenantService);
  const inventory = app.get(InventoryService);
  const catalog = app.get(CatalogService);
  const pos = app.get(PosService);
  const counts = app.get(CountsService);
  const insights = app.get(InsightsService);
  const random = rng(20260926);
  const started = Date.now();

  try {
    // ----- reset -----
    const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_OWNER.email) });
    if (existing) {
      // Cross-table references inside the tenant (recipes → ingredients, sales → products) are
      // not cascades, so remove those rows before the tenant itself.
      const tid = existing.tenantId;
      await db.execute(sql`delete from cost_lines where product_id in (select id from products where tenant_id = ${tid})`);
      await db.execute(sql`delete from order_lines where order_id in (select id from orders where tenant_id = ${tid})`);
      await db.execute(sql`delete from stock_counts where tenant_id = ${tid}`);
      await db.execute(sql`delete from ingredients where tenant_id = ${tid}`);
      await db.execute(sql`delete from products where tenant_id = ${tid}`);
      await db.delete(tenants).where(eq(tenants.id, tid));
    }

    // ----- tenant, outlets, employees -----
    const reg = await auth.registerOwner(DEMO_OWNER);
    const owner: AccessClaims = { sub: reg.user.id, kind: 'owner', role: 'OWNER', tid: reg.user.tenantId, name: DEMO_OWNER.fullName };
    await tenantSvc.setupBusiness(owner, {
      businessName: 'SteakWarung_JKT',
      phone: '+62 812 3456 7890',
      address: DEMO_OUTLETS[0]!.address,
      employeeCount: 4,
    });
    const [firstOutlet] = await tenantSvc.listOutlets(owner);
    const outlets = [firstOutlet!, await tenantSvc.createOutlet(owner, { name: DEMO_OUTLETS[1]!.name, address: DEMO_OUTLETS[1]!.address })];
    const staff = new Map<string, Employee[]>();
    for (const [i, o] of outlets.entries()) {
      const list: Employee[] = [];
      for (const e of DEMO_OUTLETS[i]!.employees) {
        list.push(await tenantSvc.createEmployee(owner, { outletId: o.id, name: e.name, role: e.role, pin: e.pin, shiftDays: ['MON', 'TUE', 'WED', 'FRI', 'SAT', 'SUN'] }));
      }
      staff.set(o.id, list);
    }
    const claimsFor = (outletId: string, role: EmployeeRole): AccessClaims => {
      const e = staff.get(outletId)!.find((x) => x.role === role)!;
      return { sub: e.id, kind: 'employee', role, tid: owner.tid, oid: outletId, name: e.name };
    };

    // ----- catalogue -----
    await inventory.ensureDefaultCategories(owner.tid);
    await catalog.ensureDefaultCategories(owner.tid);
    const stockCats = await db.select().from(stockCategories).where(eq(stockCategories.tenantId, owner.tid));
    const stockCatId = (name: string) => stockCats.find((c) => c.name === name)!.id;
    const productCats = await catalog.listCategories(owner.tid);

    // First stock-in creates each ingredient; later ones reference it by id.
    const ingredientId = new Map<string, string>();
    const today = jakartaDate();
    const startDate = addDays(today, -days);

    // Expected daily usage per ingredient from the product mix, used before real usage exists.
    const totalWeight = DEMO_PRODUCTS.reduce((s, p) => s + p.weight, 0);
    const expectedUsage = (ordersPerDay: number) => {
      const usage = new Map<string, number>();
      for (const p of DEMO_PRODUCTS) {
        const servings = (ordersPerDay * 1.9 * 1.15 * p.weight) / totalWeight;
        for (const [ing, qty] of p.recipe) usage.set(ing, (usage.get(ing) ?? 0) + servings * qty);
      }
      return usage;
    };

    // Seasonal noise on over-buying, so some months waste more than others.
    const monthWaste = new Map<string, number>();
    const wasteFactor = (date: string) => {
      const m = date.slice(0, 7);
      if (!monthWaste.has(m)) monthWaste.set(m, 0.75 + random() * 0.6);
      return monthWaste.get(m)!;
    };

    const productIds = new Map<string, string>();
    const createProducts = async (outletId: string) => {
      for (const p of DEMO_PRODUCTS) {
        const saved = await catalog.saveProduct(owner, outletId, {
          categoryId: productCats.find((c) => c.name === p.category)!.id,
          name: p.name,
          price: p.price,
          active: true,
          costLines: [
            ...p.recipe.map(([ing, qty]) => {
              const base = DEMO_INGREDIENTS.find((i) => i.name === ing)!.base;
              return { type: 'INGREDIENT' as const, ingredientId: ingredientId.get(ing)!, qty, unit: base };
            }),
            ...(p.labour ? [{ type: 'LABOUR' as const, label: 'Gaji Koki', qty: 1, unit: 'org', value: p.labour }] : []),
            ...(p.overhead ? [{ type: 'OVERHEAD' as const, label: 'Listrik & Air', qty: 1, unit: 'pcs', value: p.overhead }] : []),
          ],
        });
        productIds.set(p.name, saved.id);
      }
    };

    for (const [oi, outlet] of outlets.entries()) {
      const plan = DEMO_OUTLETS[oi]!;
      const chef = claimsFor(outlet.id, 'HEAD_CHEF');
      const cashier = claimsFor(outlet.id, 'CASHIER');
      const usage = expectedUsage(plan.ordersPerDay);
      const recent: Map<string, number>[] = [];
      let orderCount = 0;

      for (let d = 0; d <= days; d++) {
        const date = addDays(startDate, d);
        const isToday = date === today;
        await inventory.expirySweep(at(date, 6), outlet.id);

        {
          // Rolling average of real usage over the last 14 days, else the product-mix estimate.
          const avg = (name: string) => (recent.length >= 7 ? recent.reduce((s, m) => s + (m.get(name) ?? 0), 0) / recent.length : (usage.get(name) ?? 0));
          for (const ing of DEMO_INGREDIENTS) {
            // Perishables are bought daily for ~2 days; everything else every few days.
            const perishable = ing.shelfLifeDays <= 5;
            if (!perishable && d % RESTOCK_EVERY_DAYS !== 0 && !isToday) continue;
            const daily = avg(ing.name);
            if (daily <= 0) continue;
            let overbuy = oi === 1 && ing.overbuyCabang2 !== undefined ? ing.overbuyCabang2 : ing.overbuy;
            if (overbuy > 1) overbuy = 1 + (overbuy - 1) * wasteFactor(date);
            const coverDays = perishable ? 2 : RESTOCK_EVERY_DAYS + 1;
            const id = ingredientId.get(ing.name);
            const onHand = id ? Math.max(0, await inventory.onHand(db, outlet.id, id)) : 0;
            // Shelf-stable items keep a safety buffer; perishables are bought for the next few days only.
            const buffer = overbuy >= 1 && ing.shelfLifeDays > 10 ? ing.critical : 0;
            const target = daily * coverDays * overbuy + buffer;
            const step = ing.base === 'pcs' ? 12 : 250;
            const qty = Math.ceil((target - onHand) / step) * step;
            if (qty <= 0) continue;
            const price = Math.round(ing.price * (0.95 + random() * 0.1) * (ing.base === 'pcs' ? 1 : 1000));
            const res = await inventory.stockIn(
              chef,
              {
                outletId: outlet.id,
                ...(id ? { ingredientId: id } : { name: ing.name, categoryId: stockCatId(ing.category) }),
                qty,
                unit: ing.base,
                price,
                priceUnit: ing.base === 'gr' ? 'kg' : ing.base === 'ml' ? 'L' : 'pcs',
                criticalQty: ing.critical,
                criticalUnit: ing.base,
                storage: ing.storage,
                expiryDate: addDays(date, ing.shelfLifeDays),
              },
              at(date, 7, Math.floor(random() * 50)),
            );
            ingredientId.set(ing.name, res.ingredientId);
          }
          if (d === 0 && oi === 0) await createProducts(outlet.id);
        }

        // Orders: busier Fri–Sun and around payday (25th–2nd).
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        const dom = Number(date.slice(8, 10));
        const factor = (dow === 0 || dow >= 5 ? 1.35 : 1) * (dom >= 25 || dom <= 2 ? 1.15 : 1) * (0.85 + random() * 0.3);
        const n = Math.round(plan.ordersPerDay * factor);
        const nowMs = Date.now();
        const times = Array.from({ length: n }, () => 11 * 60 + Math.floor(random() * 600)).sort((a, b) => a - b);
        const dayUsage = new Map<string, number>();
        for (const minute of times) {
          const when = at(date, 0, minute);
          if (isToday && when.getTime() > nowMs - 60_000) break;
          const lineCount = 1 + Math.floor(random() * 3);
          const lines = new Map<string, number>();
          for (let l = 0; l < lineCount; l++) {
            let r = random() * totalWeight;
            const p = DEMO_PRODUCTS.find((x) => (r -= x.weight) < 0)!;
            lines.set(p.name, (lines.get(p.name) ?? 0) + (random() < 0.8 ? 1 : 2));
          }
          const total = [...lines].reduce((s, [name, qty]) => s + DEMO_PRODUCTS.find((p) => p.name === name)!.price * qty, 0);
          const cash = random() < 0.45;
          const methods = ['QRIS', 'QRIS', 'GOPAY', 'DANA', 'BCA', 'MASTERCARD'] as const;
          await pos.createOrder(
            cashier,
            {
              clientId: randomUUID(),
              outletId: outlet.id,
              lines: [...lines].map(([name, qty]) => ({ productId: productIds.get(name)!, qty })),
              payment: cash ? { method: 'CASH', tendered: Math.ceil(total / 50000) * 50000 } : { method: methods[Math.floor(random() * methods.length)]! },
            },
            when,
          );
          orderCount++;
          for (const [name, qty] of lines) {
            for (const [ing, q] of DEMO_PRODUCTS.find((p) => p.name === name)!.recipe) dayUsage.set(ing, (dayUsage.get(ing) ?? 0) + q * qty);
          }
        }
        recent.push(dayUsage);
        if (recent.length > 14) recent.shift();

        // Weekly meat count on Sunday night, with small shrinkage (more for chicken breast at Cabang 2).
        if (dow === 0 && !isToday) {
          const count = await counts.start(chef, outlet.id, stockCatId('Daging'), at(date, 22));
          const lines = count.lines.map((l) => {
            const shrink = oi === 1 && l.name === 'Dada Ayam Fillet' ? 0.04 + random() * 0.04 : random() * 0.025;
            return { ingredientId: l.ingredientId, counted: Math.max(0, Math.round(l.expected * (1 - shrink))) };
          });
          if (lines.length) {
            await counts.saveLines(chef, count.id, { lines });
            await counts.commit(chef, count.id, at(date, 22, 30));
          }
        }
        if (d % 30 === 0) log(`  ${outlet.name}: ${date} (${orderCount} orders so far, ${Math.round((Date.now() - started) / 1000)}s)`);
      }
      log(`${outlet.name}: ${orderCount} orders`);
    }

    // Demo prep (see the MVP spec's script): Cabang 1 starts with 1.800 gr sirloin, so selling
    // 2 Sirloin Steak (400 gr) crosses the 1.500 gr critical line live; chicken thigh sits at
    // 4.000 gr for the stock-count step (count 3.750 → −250 gr).
    const prep = claimsFor(outlets[0]!.id, 'HEAD_CHEF');
    for (const [name, target] of [['Beef Sirloin Lokal', 1800], ['Paha Ayam Fillet', 4000]] as const) {
      const id = ingredientId.get(name)!;
      const ing = DEMO_INGREDIENTS.find((i) => i.name === name)!;
      const current = await inventory.onHand(db, outlets[0]!.id, id);
      if (current < target) {
        await inventory.stockIn(prep, {
          outletId: outlets[0]!.id, ingredientId: id, qty: Math.round(target - current), unit: 'gr',
          price: ing.price * 1000, priceUnit: 'kg', storage: ing.storage, expiryDate: addDays(today, ing.shelfLifeDays),
        });
      } else if (current > target) {
        const count = await counts.start(prep, outlets[0]!.id, stockCatId('Daging'));
        await counts.saveLines(prep, count.id, { lines: [{ ingredientId: id, counted: target }] });
        await counts.commit(prep, count.id);
      }
    }

    // Pre-generate the cached insight text so the demo screens load instantly.
    for (const o of outlets) {
      await insights.get(owner, o.id, 'analysis', jakartaMonth().slice(0, 4), true);
      await insights.get(owner, o.id, 'forecast', addMonths(jakartaMonth(), 1), true);
    }
    log(`Done in ${Math.round((Date.now() - started) / 1000)}s. Owner login: ${DEMO_OWNER.email} / ${DEMO_OWNER.password} (OTP 123456 in demo mode)`);
  } finally {
    await app.close();
  }
}

if (isEntrypoint(import.meta.url)) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; rely on the real environment.
  }
  const i = process.argv.indexOf('--days');
  await seedDemo(i > 0 ? Number(process.argv[i + 1]) : 180);
}
