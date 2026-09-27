import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { UPLOAD_DIR } from './uploads/uploads.controller.js';
import { AppModule } from './app.module.js';
import { AppConfig, loadConfig } from './config.js';
import { isEntrypoint } from './common/entrypoint.js';

export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.enableVersioning({ type: VersioningType.URI });
  // Product photos arrive as base64 data URLs (max 2 MB image ≈ 2.7 MB encoded).
  app.useBodyParser('json', { limit: '4mb' });
  mkdirSync(UPLOAD_DIR, { recursive: true });
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads/' });
  app.enableCors();
  app.enableShutdownHooks();
  return app;
}

async function bootstrap(config: AppConfig) {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { bodyParser: true }));
  await app.listen(config.PORT, '0.0.0.0');
}

if (isEntrypoint(import.meta.url)) {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; rely on the real environment.
  }
  await bootstrap(loadConfig());
}
