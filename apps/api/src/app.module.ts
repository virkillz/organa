import { Controller, DynamicModule, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { LoggingOtpSender, OtpSender } from './auth/otp.sender.js';
import { AuthGuard, Public } from './common/auth.guard.js';
import { APP_CONFIG, AppConfig } from './config.js';
import { DbModule } from './db/db.module.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CountsController } from './counts/counts.controller.js';
import { CountsService } from './counts/counts.service.js';
import { AnalyticsService } from './insights/analytics.service.js';
import { InsightsController } from './insights/insights.controller.js';
import { InsightsService } from './insights/insights.service.js';
import { ExpiryScheduler, InventoryController } from './inventory/inventory.controller.js';
import { InventoryService } from './inventory/inventory.service.js';
import { PosController } from './pos/pos.controller.js';
import { PosService } from './pos/pos.service.js';
import { TenantController } from './tenant/tenant.controller.js';
import { UploadsController } from './uploads/uploads.controller.js';
import { TenantService } from './tenant/tenant.service.js';

@Controller({ path: 'health', version: '1' })
class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    const configModule: DynamicModule = {
      module: class ConfigModule {},
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
    return {
      module: AppModule,
      imports: [
        configModule,
        DbModule,
        JwtModule.register({ secret: config.JWT_SECRET, signOptions: { expiresIn: '15m' } }),
      ],
      controllers: [
        HealthController,
        AuthController,
        TenantController,
        InventoryController,
        CatalogController,
        PosController,
        CountsController,
        InsightsController,
        UploadsController,
      ],
      providers: [
        AuthService,
        TenantService,
        InventoryService,
        ExpiryScheduler,
        CatalogService,
        PosService,
        CountsService,
        AnalyticsService,
        InsightsService,
        { provide: OtpSender, useClass: LoggingOtpSender },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    };
  }
}
