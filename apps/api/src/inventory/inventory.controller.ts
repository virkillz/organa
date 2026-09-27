import { Body, Controller, Get, Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import { createStockCategorySchema, STOCK_STATUSES, stockInSchema, updateIngredientSchema } from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, RequireFeature } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from '../tenant/tenant.service.js';
import { InventoryService } from './inventory.service.js';

const outletQuery = z.object({ outletId: z.string().uuid() });
const stockQuery = outletQuery.extend({
  categoryId: z.string().uuid().optional(),
  status: z.enum(STOCK_STATUSES).optional(),
});
const alertsQuery = outletQuery.extend({ since: z.coerce.date().optional() });
const ingredientsQuery = z.object({ categoryId: z.string().uuid().optional() });

@Controller({ version: '1' })
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(TenantService) private readonly tenants: TenantService,
  ) {}

  /** Checks outlet access and writes off anything that expired since the last sweep. */
  private async prepare(user: AccessClaims, outletId: string) {
    await this.tenants.assertOutlet(user, outletId);
    await this.inventory.expirySweep(new Date(), outletId);
  }

  @RequireFeature('stock')
  @Get('stock-categories')
  categories(@CurrentUser() user: AccessClaims) {
    return this.inventory.listCategories(user.tid);
  }

  @RequireFeature('stock')
  @Post('stock-categories')
  createCategory(@CurrentUser() user: AccessClaims, @Body(new ZodPipe(createStockCategorySchema)) body: z.output<typeof createStockCategorySchema>) {
    return this.inventory.createCategory(user.tid, body);
  }

  @RequireFeature('stock')
  @Get('ingredients')
  ingredients(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(ingredientsQuery)) q: z.infer<typeof ingredientsQuery>) {
    return this.inventory.listIngredients(user.tid, q.categoryId);
  }

  @RequireFeature('stock')
  @Patch('ingredients/:id')
  updateIngredient(
    @CurrentUser() user: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateIngredientSchema)) body: z.infer<typeof updateIngredientSchema>,
  ) {
    return this.inventory.updateIngredient(user, id, body);
  }

  @RequireFeature('stock')
  @Get('ingredients/:id/stock')
  async ingredientDetail(@CurrentUser() user: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>) {
    await this.prepare(user, q.outletId);
    return this.inventory.ingredientDetail(user, q.outletId, id);
  }

  @RequireFeature('stock')
  @Get('stock')
  async stock(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(stockQuery)) q: z.infer<typeof stockQuery>) {
    await this.prepare(user, q.outletId);
    return this.inventory.stockLevels(user, q.outletId, { categoryId: q.categoryId, status: q.status });
  }

  @RequireFeature('stock')
  @Get('stock/summary')
  async summary(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>) {
    await this.prepare(user, q.outletId);
    return this.inventory.summary(user, q.outletId);
  }

  @RequireFeature('stock')
  @Get('stock/expiring')
  async expiring(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>) {
    await this.prepare(user, q.outletId);
    return this.inventory.expiringRows(q.outletId);
  }

  @RequireFeature('stock')
  @Get('stock/expired')
  async expired(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>) {
    await this.prepare(user, q.outletId);
    return this.inventory.expiredRows(q.outletId);
  }

  @RequireFeature('stock')
  @Post('stock-ins')
  async stockIn(@CurrentUser() user: AccessClaims, @Body(new ZodPipe(stockInSchema)) body: z.input<typeof stockInSchema>) {
    await this.tenants.assertOutlet(user, body.outletId);
    return this.inventory.stockIn(user, body);
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(alertsQuery)) q: z.infer<typeof alertsQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.inventory.listAlerts(q.outletId, q.since);
  }
}

/** Hourly expiry write-off for all outlets (reads also sweep their outlet on demand). */
@Injectable()
export class ExpiryScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('ExpiryScheduler');
  private timer?: NodeJS.Timeout;

  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  onModuleInit() {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => {
      this.inventory.expirySweep().then(
        (n) => n && this.logger.log(`Wrote off ${n} expired batches`),
        (e) => this.logger.error(e),
      );
    }, 3600_000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
