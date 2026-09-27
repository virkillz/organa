import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { bearer, createTestApp, ownerWithOutlet } from './helpers.js';

describe('access control on inventory, catalog, POS and insights (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('keeps other tenants out of every outlet-scoped endpoint', async () => {
    const a = await ownerWithOutlet(http, 'iso-a@example.com');
    const b = await ownerWithOutlet(http, 'iso-b@example.com');
    const paths = ['stock', 'stock/summary', 'stock/expiring', 'stock/expired', 'products', 'alerts', 'orders', 'analysis', 'forecast', 'dashboard'];
    for (const p of paths) {
      await http.get(`/v1/${p}?outletId=${a.outletId}`).set(bearer(b.token)).expect(404);
    }
    const cats = await http.get('/v1/stock-categories').set(bearer(a.token));
    await http.post('/v1/stock-counts').set(bearer(b.token)).send({ outletId: a.outletId, categoryId: cats.body[0].id }).expect(404);
  });

  it('limits a cashier to the POS', async () => {
    const owner = await ownerWithOutlet(http, 'roles@example.com');
    const cashier = await http
      .post('/v1/employees')
      .set(bearer(owner.token))
      .send({ outletId: owner.outletId, name: 'Abdul', role: 'CASHIER', pin: '654321', shiftDays: ['MON'] })
      .expect(201);
    const device = await http.post('/v1/auth/devices').set(bearer(owner.token)).send({ outletId: owner.outletId }).expect(201);
    const login = await http
      .post('/v1/auth/employee/login')
      .set({ 'X-Device-Token': device.body.deviceToken })
      .send({ employeeId: cashier.body.id, pin: '654321' })
      .expect(200);
    const t = bearer(login.body.accessToken);
    await http.get(`/v1/products?outletId=${owner.outletId}`).set(t).expect(200);
    await http.get(`/v1/orders?outletId=${owner.outletId}`).set(t).expect(200);
    for (const p of ['stock', 'stock/summary', 'analysis', 'forecast', 'dashboard']) {
      await http.get(`/v1/${p}?outletId=${owner.outletId}`).set(t).expect(403);
    }
    await http.post('/v1/stock-ins').set(t).send({}).expect(403);
  });
});
