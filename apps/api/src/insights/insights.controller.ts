import { Controller, Get, Inject, Post, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, OwnerOnly, RequireFeature } from '../common/auth.guard.js';
import { jakartaMonth, addMonths } from '../common/time.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from '../tenant/tenant.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AnalyticsService } from './analytics.service.js';
import { InsightsService } from './insights.service.js';

const outlet = z.string().uuid();
const period = z.string().regex(/^\d{4}(-\d{2})?$/, 'Periode YYYY atau YYYY-MM');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Bulan YYYY-MM');
const analysisQuery = z.object({ outletId: outlet, period: period.default(() => jakartaMonth().slice(0, 4)) });
const forecastQuery = z.object({ outletId: outlet, month: month.default(() => addMonths(jakartaMonth(), 1)) });
const insightQuery = z.object({ outletId: outlet, kind: z.enum(['analysis', 'forecast']), period });

@Controller({ version: '1' })
export class InsightsController {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(InsightsService) private readonly insights: InsightsService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(TenantService) private readonly tenants: TenantService,
  ) {}

  @RequireFeature('analysis')
  @Get('analysis')
  async analysis(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(analysisQuery)) q: z.infer<typeof analysisQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    await this.inventory.expirySweep(new Date(), q.outletId);
    return this.analytics.analysis(q.outletId, q.period);
  }

  @RequireFeature('forecast')
  @Get('forecast')
  async forecast(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(forecastQuery)) q: z.infer<typeof forecastQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.analytics.forecast(user, q.outletId, q.month);
  }

  @RequireFeature('analysis')
  @Get('insights')
  async insight(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(insightQuery)) q: z.infer<typeof insightQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.insights.get(user, q.outletId, q.kind, q.period);
  }

  @RequireFeature('analysis')
  @Post('insights/regenerate')
  async regenerate(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(insightQuery)) q: z.infer<typeof insightQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.insights.get(user, q.outletId, q.kind, q.period, true);
  }

  @OwnerOnly()
  @Get('dashboard')
  async dashboard(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(z.object({ outletId: outlet }))) q: { outletId: string }) {
    await this.tenants.assertOutlet(user, q.outletId);
    await this.inventory.expirySweep(new Date(), q.outletId);
    return this.analytics.dashboard(user, q.outletId);
  }
}
