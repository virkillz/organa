import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import type request from 'supertest';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { bearer, createTestApp, ownerWithOutlet } from './helpers.js';

const isoDate = (days: number) => {
  const d = new Date(Date.now() + 7 * 3600_000 + days * 86400_000);
  return d.toISOString().slice(0, 10);
};

describe('stock → recipe → sale → count loop (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  let token: string;
  let outletId: string;
  let meatId: string;
  let beefId: string;
  let spiceId: string;
  let steakId: string;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    ({ token, outletId } = await ownerWithOutlet(http, 'loop@example.com'));
  });
  afterAll(async () => {
    await app.close();
  });

  const auth = () => bearer(token);

  it('seeds default stock and product categories', async () => {
    const cats = await http.get('/v1/stock-categories').set(auth()).expect(200);
    const meat = cats.body.find((c: { name: string }) => c.name === 'Daging');
    expect(meat).toBeTruthy();
    meatId = meat.id;
    expect(cats.body.some((c: { name: string; parentId: string }) => c.name === 'Daging Ayam' && c.parentId === meatId)).toBe(true);
    const pcats = await http.get('/v1/product-categories').set(auth()).expect(200);
    expect(pcats.body.map((c: { name: string }) => c.name)).toContain('Main Menu');
  });

  it('stocks in two batches and values stock at cost', async () => {
    // Older batch expires later; newer batch expires first, so FEFO must take the newer one first.
    const a = await http
      .post('/v1/stock-ins')
      .set(auth())
      .send({ outletId, categoryId: meatId, name: 'Beef Sirloin Lokal', qty: 3, unit: 'kg', price: 250000, priceUnit: 'kg', criticalQty: 2900, criticalUnit: 'gr', storage: 'FREEZER', expiryDate: isoDate(60) })
      .expect(201);
    beefId = a.body.ingredientId;
    await http
      .post('/v1/stock-ins')
      .set(auth())
      .send({ outletId, ingredientId: beefId, qty: 1000, unit: 'gr', price: 300, priceUnit: 'gr', storage: 'CHILLER', expiryDate: isoDate(2) })
      .expect(201);
    const cats = await http.get('/v1/stock-categories').set(auth());
    const spices = cats.body.find((c: { name: string }) => c.name === 'Bumbu & Rempah');
    const s = await http
      .post('/v1/stock-ins')
      .set(auth())
      .send({ outletId, categoryId: spices.id, name: 'Bumbu Steak', qty: 500, unit: 'gr', price: 100000, priceUnit: 'kg', storage: 'ROOM', expiryDate: isoDate(30) })
      .expect(201);
    spiceId = s.body.ingredientId;

    const stock = await http.get(`/v1/stock?outletId=${outletId}&categoryId=${meatId}`).set(auth()).expect(200);
    const beef = stock.body.find((i: { ingredientId: string }) => i.ingredientId === beefId);
    expect(beef.onHand).toBe(4000);
    // 3000 gr × Rp250 + 1000 gr × Rp300 = Rp1.050.000
    expect(beef.value).toBe(1_050_000);
    expect(beef.status).toBe('expiring');

    const summary = await http.get(`/v1/stock/summary?outletId=${outletId}`).set(auth()).expect(200);
    expect(summary.body.expiring).toEqual({ count: 1, value: 300_000 });
    const expiring = await http.get(`/v1/stock/expiring?outletId=${outletId}`).set(auth()).expect(200);
    expect(expiring.body.reduce((s: number, r: { value: number }) => s + r.value, 0)).toBe(summary.body.expiring.value);
  });

  it('rejects a unit that does not match the ingredient', async () => {
    await http
      .post('/v1/stock-ins')
      .set(auth())
      .send({ outletId, ingredientId: beefId, qty: 1, unit: 'L', price: 1, priceUnit: 'L', storage: 'ROOM', expiryDate: isoDate(3) })
      .expect(400);
  });

  it('computes HPP from recipe lines and manual costs', async () => {
    const pcats = await http.get('/v1/product-categories').set(auth());
    const main = pcats.body.find((c: { name: string }) => c.name === 'Main Menu');
    const res = await http
      .post(`/v1/products?outletId=${outletId}`)
      .set(auth())
      .send({
        categoryId: main.id,
        name: 'Sirloin Steak',
        price: 120000,
        costLines: [
          { type: 'INGREDIENT', ingredientId: beefId, qty: 200, unit: 'gr' },
          { type: 'INGREDIENT', ingredientId: spiceId, qty: 20, unit: 'gr' },
          { type: 'LABOUR', label: 'Gaji Koki', qty: 2, unit: 'org', value: 10000 },
          { type: 'OVERHEAD', label: 'Listrik & Air', qty: 1, unit: 'pcs', value: 1000 },
        ],
      })
      .expect(201);
    steakId = res.body.id;
    const counted = await http.get('/v1/product-categories').set(auth());
    expect(counted.body.find((c: { name: string }) => c.name === 'Main Menu').productCount).toBe(1);
    // Beef avg cost = 1.050.000 / 4000 = 262.5/gr → 52.500; spice 100/gr → 2.000; + 11.000
    expect(res.body.hpp).toBe(65_500);
    expect(res.body.margin).toBe(54_500);
    expect(res.body.costLines).toHaveLength(4);
  });

  it('deducts the recipe FEFO on sale, is idempotent, and raises a critical alert', async () => {
    const clientId = randomUUID();
    const body = { clientId, outletId, lines: [{ productId: steakId, qty: 2 }, { name: 'Es Teh', unitPrice: 5000, qty: 1 }], payment: { method: 'CASH', tendered: 250000 } };
    const order = await http.post('/v1/orders').set(auth()).send(body).expect(201);
    expect(order.body).toMatchObject({ total: 245000, change: 5000, itemCount: 3 });
    // 4000 − 400 = 3600 > 2900: no alert yet.
    expect(order.body.alerts).toEqual([]);
    const again = await http.post('/v1/orders').set(auth()).send(body).expect(201);
    expect(again.body.id).toBe(order.body.id);

    const detail = await http.get(`/v1/ingredients/${beefId}/stock?outletId=${outletId}`).set(auth()).expect(200);
    expect(detail.body.stock.onHand).toBe(3600);
    // FEFO: the 1000 gr chiller batch (expires first) lost 400 gr, the freezer batch is untouched.
    const chiller = detail.body.batches.find((b: { storage: string }) => b.storage === 'CHILLER');
    expect(chiller.qtyRemaining).toBe(600);

    const big = await http
      .post('/v1/orders')
      .set(auth())
      .send({ clientId: randomUUID(), outletId, lines: [{ productId: steakId, qty: 4 }], payment: { method: 'QRIS' } })
      .expect(201);
    expect(big.body.simulated).toBe(true);
    expect(big.body.alerts).toEqual([{ ingredientId: beefId, name: 'Beef Sirloin Lokal', kind: 'CRITICAL' }]);
    const alerts = await http.get(`/v1/alerts?outletId=${outletId}`).set(auth()).expect(200);
    expect(alerts.body[0].kind).toBe('CRITICAL');
  });

  it('rejects cash below the total', async () => {
    await http
      .post('/v1/orders')
      .set(auth())
      .send({ clientId: randomUUID(), outletId, lines: [{ productId: steakId, qty: 1 }], payment: { method: 'CASH', tendered: 1000 } })
      .expect(400);
  });

  it('posts a stock count as signed adjustments', async () => {
    const count = await http.post('/v1/stock-counts').set(auth()).send({ outletId, categoryId: meatId }).expect(201);
    const line = count.body.lines.find((l: { ingredientId: string }) => l.ingredientId === beefId);
    expect(line.expected).toBe(2800);
    await http.put(`/v1/stock-counts/${count.body.id}/lines`).set(auth()).send({ lines: [{ ingredientId: beefId, counted: 2550 }] }).expect(200);
    const committed = await http.post(`/v1/stock-counts/${count.body.id}/commit`).set(auth()).expect(201);
    const cl = committed.body.lines.find((l: { ingredientId: string }) => l.ingredientId === beefId);
    expect(cl.variance).toBe(-250);
    expect(committed.body.status).toBe('COMMITTED');
    const detail = await http.get(`/v1/ingredients/${beefId}/stock?outletId=${outletId}`).set(auth());
    expect(detail.body.stock.onHand).toBe(2550);
    await http.post(`/v1/stock-counts/${count.body.id}/commit`).set(auth()).expect(400);
  });

  it('writes off expired batches and reports them as waste', async () => {
    const inventory = app.get(InventoryService);
    // The sales used up the first chiller batch (FEFO), so stock one that will expire untouched.
    await http
      .post('/v1/stock-ins')
      .set(auth())
      .send({ outletId, categoryId: meatId, name: 'Kulit Ayam', qty: 400, unit: 'gr', price: 100, priceUnit: 'gr', storage: 'CHILLER', expiryDate: isoDate(1) })
      .expect(201);
    // Three days from now that batch (expiry +1) is past its date.
    const future = new Date(Date.now() + 3 * 86400_000);
    expect(await inventory.expirySweep(future, outletId)).toBe(1);
    expect(await inventory.expirySweep(future, outletId)).toBe(0);

    const year = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4);
    const analysis = await http.get(`/v1/analysis?outletId=${outletId}&period=${year}`).set(auth()).expect(200);
    expect(analysis.body.totalWasteValue).toBe(40_000 + 250 * 250);
    const shareSum = analysis.body.topItems.reduce((s: number, i: { share: number }) => s + i.share, 0);
    expect(shareSum).toBeCloseTo(1, 5);

    const insight = await http.get(`/v1/insights?outletId=${outletId}&kind=analysis&period=${year}`).set(auth()).expect(200);
    expect(insight.body.sections.map((s: { title: string }) => s.title)).toEqual(['Unit Terbuang', 'Stock Out', 'Saran Strategis']);

    await http.get(`/v1/forecast?outletId=${outletId}`).set(auth()).expect(200);
    const dash = await http.get(`/v1/dashboard?outletId=${outletId}`).set(auth()).expect(200);
    expect(dash.body.ordersToday).toBe(2);
    expect(dash.body.salesToday).toBe(245000 + 480000);
  });
});
