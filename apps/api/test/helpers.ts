import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import postgres from 'postgres';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { runMigrations } from '../src/db/migrate.js';
import { configureApp } from '../src/main.js';

export const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/organa_test';

export async function createTestApp() {
  await runMigrations(DATABASE_URL);
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`TRUNCATE tenants CASCADE`;
  await sql.end();
  const moduleRef = await Test.createTestingModule({
    imports: [
      AppModule.forRoot({ DATABASE_URL, JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long', DEMO_MODE: true, PORT: 0 }),
    ],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  // Listen once: letting supertest open and close an ephemeral server per request hangs intermittently.
  await app.listen(0, '127.0.0.1');
  return { app, http: request(await app.getUrl()) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Registers an owner, completes business setup and returns the token and first outlet id. */
export async function ownerWithOutlet(http: ReturnType<typeof request>, email: string) {
  const reg = await http.post('/v1/auth/register').send({ fullName: 'Owner', email, password: 'rahasia123' }).expect(201);
  const token = reg.body.accessToken as string;
  await http
    .put('/v1/tenant/setup')
    .set(bearer(token))
    .send({ businessName: 'SteakWarung_JKT', phone: '+62 812 3456 7890', address: 'Jakarta Utara', employeeCount: 3 })
    .expect(200);
  const outlets = await http.get('/v1/outlets').set(bearer(token)).expect(200);
  return { token, outletId: outlets.body[0].id as string };
}
