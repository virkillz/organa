import type { NestExpressApplication } from '@nestjs/platform-express';
import type request from 'supertest';
import { createTestApp } from './helpers.js';

describe('auth + tenant (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function registerOwner(email: string) {
    const res = await http
      .post('/v1/auth/register')
      .send({ fullName: 'Elvin Eka', email, password: 'rahasia123' })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string; user: { needsBusinessSetup: boolean } };
  }

  async function setupBusiness(accessToken: string) {
    await http
      .put('/v1/tenant/setup')
      .set(bearer(accessToken))
      .send({ businessName: 'SteakWarung_JKT', phone: '+62 812 3456 7890', address: 'Jakarta Utara', employeeCount: '5' })
      .expect(200);
    const outlets = await http.get('/v1/outlets').set(bearer(accessToken)).expect(200);
    return outlets.body[0].id as string;
  }

  it('registers an owner, sets up the business and creates Cabang 1', async () => {
    const reg = await registerOwner('elvin@example.com');
    expect(reg.user.needsBusinessSetup).toBe(true);

    await http.post('/v1/auth/register').send({ fullName: 'X', email: 'elvin@example.com', password: 'rahasia123' }).expect(400);
    await http.post('/v1/auth/register').send({ fullName: 'Elvin', email: 'ELVIN@example.com', password: 'rahasia123' }).expect(409);

    await setupBusiness(reg.accessToken);
    const outlets = await http.get('/v1/outlets').set(bearer(reg.accessToken)).expect(200);
    expect(outlets.body).toHaveLength(1);
    expect(outlets.body[0].name).toBe('Cabang 1');

    const me = await http.get('/v1/auth/me').set(bearer(reg.accessToken)).expect(200);
    expect(me.body).toMatchObject({ role: 'OWNER', tenantName: 'SteakWarung_JKT', needsBusinessSetup: false });
  });

  it('logs the owner in with password + OTP', async () => {
    await http.post('/v1/auth/owner/login').send({ email: 'elvin@example.com', password: 'salah-salah' }).expect(401);
    await http.post('/v1/auth/owner/login').send({ email: 'nobody@example.com', password: 'rahasia123' }).expect(401);

    const start = await http
      .post('/v1/auth/owner/login')
      .send({ email: 'elvin@example.com', password: 'rahasia123', otpChannel: 'WHATSAPP' })
      .expect(200);
    expect(start.body).toMatchObject({ channel: 'WHATSAPP', destination: '+62****7890' });

    // Without a business phone, phone channels fall back to email.
    await http.post('/v1/auth/register').send({ fullName: 'No Phone', email: 'nophone@example.com', password: 'rahasia123' });
    const fallback = await http
      .post('/v1/auth/owner/login')
      .send({ email: 'nophone@example.com', password: 'rahasia123', otpChannel: 'SMS' })
      .expect(200);
    expect(fallback.body).toMatchObject({ channel: 'EMAIL', destination: 'no***@example.com' });

    await http.post('/v1/auth/otp/verify').send({ challengeId: start.body.challengeId, code: '000000' }).expect(401);
    const ok = await http.post('/v1/auth/otp/verify').send({ challengeId: start.body.challengeId, code: '123456' }).expect(200);
    expect(ok.body.user.role).toBe('OWNER');
    // A challenge can only be used once.
    await http.post('/v1/auth/otp/verify').send({ challengeId: start.body.challengeId, code: '123456' }).expect(401);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const reg = await registerOwner('rotate@example.com');
    const first = await http.post('/v1/auth/refresh').send({ refreshToken: reg.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(reg.refreshToken);
    await http.post('/v1/auth/refresh').send({ refreshToken: reg.refreshToken }).expect(401);

    await http.post('/v1/auth/logout').send({ refreshToken: first.body.refreshToken }).expect(204);
    await http.post('/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it('lets employees log in with a PIN on a registered device, scoped by role', async () => {
    const owner = await registerOwner('pin-owner@example.com');
    const outletId = await setupBusiness(owner.accessToken);

    const cashier = await http
      .post('/v1/employees')
      .set(bearer(owner.accessToken))
      .send({ outletId, name: 'Abdul', role: 'CASHIER', pin: '654321', shiftDays: ['MON', 'TUE'] })
      .expect(201);
    expect(cashier.body).not.toHaveProperty('pinHash');

    await http.get('/v1/auth/employees').expect(401);
    const device = await http
      .post('/v1/auth/devices')
      .set(bearer(owner.accessToken))
      .send({ outletId, name: 'Tablet kasir' })
      .expect(201);
    const deviceHeader = { 'X-Device-Token': device.body.deviceToken };

    const options = await http.get('/v1/auth/employees').set(deviceHeader).expect(200);
    expect(options.body).toEqual([{ id: cashier.body.id, name: 'Abdul', role: 'CASHIER' }]);

    const login = await http
      .post('/v1/auth/employee/login')
      .set(deviceHeader)
      .send({ employeeId: cashier.body.id, pin: '654321' })
      .expect(200);
    expect(login.body.user).toMatchObject({ kind: 'employee', role: 'CASHIER', outletIds: [outletId] });

    // Cashiers cannot manage employees or register devices.
    await http.get('/v1/employees').set(bearer(login.body.accessToken)).expect(403);
    await http.post('/v1/auth/devices').set(bearer(login.body.accessToken)).send({ outletId }).expect(403);
  });

  it('locks an employee for 5 minutes after 5 wrong PINs', async () => {
    const owner = await registerOwner('lock-owner@example.com');
    const outletId = await setupBusiness(owner.accessToken);
    const chef = await http
      .post('/v1/employees')
      .set(bearer(owner.accessToken))
      .send({ outletId, name: 'Marcell', role: 'HEAD_CHEF', pin: '123456', shiftDays: ['MON'] })
      .expect(201);
    const device = await http.post('/v1/auth/devices').set(bearer(owner.accessToken)).send({ outletId }).expect(201);
    const deviceHeader = { 'X-Device-Token': device.body.deviceToken };

    for (let i = 0; i < 5; i++) {
      await http.post('/v1/auth/employee/login').set(deviceHeader).send({ employeeId: chef.body.id, pin: '000000' }).expect(401);
    }
    await http.post('/v1/auth/employee/login').set(deviceHeader).send({ employeeId: chef.body.id, pin: '123456' }).expect(429);
  });

  it('keeps tenants isolated', async () => {
    const a = await registerOwner('tenant-a@example.com');
    const outletA = await setupBusiness(a.accessToken);
    const b = await registerOwner('tenant-b@example.com');
    await setupBusiness(b.accessToken);

    await http
      .post('/v1/employees')
      .set(bearer(b.accessToken))
      .send({ outletId: outletA, name: 'Intruder', role: 'CASHIER', pin: '111111', shiftDays: ['MON'] })
      .expect(404);
    await http.post('/v1/auth/devices').set(bearer(b.accessToken)).send({ outletId: outletA }).expect(404);
    const outletsB = await http.get('/v1/outlets').set(bearer(b.accessToken)).expect(200);
    expect(outletsB.body.map((o: { id: string }) => o.id)).not.toContain(outletA);
  });
});
