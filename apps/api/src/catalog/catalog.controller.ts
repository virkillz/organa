import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import { createProductCategorySchema, saveProductSchema } from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, RequireFeature } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from '../tenant/tenant.service.js';
import { CatalogService } from './catalog.service.js';

const outletQuery = z.object({ outletId: z.string().uuid() });
const productsQuery = outletQuery.extend({
  categoryId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional(),
});

@Controller({ version: '1' })
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(TenantService) private readonly tenants: TenantService,
  ) {}

  /** Categories and products are read by the POS too, so reads are open to every role. */
  @Get('product-categories')
  categories(@CurrentUser() user: AccessClaims) {
    return this.catalog.listCategories(user.tid);
  }

  @RequireFeature('products')
  @Post('product-categories')
  createCategory(@CurrentUser() user: AccessClaims, @Body(new ZodPipe(createProductCategorySchema)) body: z.output<typeof createProductCategorySchema>) {
    return this.catalog.createCategory(user.tid, body);
  }

  @Get('products')
  async products(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(productsQuery)) q: z.infer<typeof productsQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.catalog.listProducts(user, q.outletId, { categoryId: q.categoryId, activeOnly: q.active === 'true' });
  }

  @RequireFeature('products')
  @Get('products/:id')
  async product(@CurrentUser() user: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.catalog.getProduct(user, q.outletId, id);
  }

  @RequireFeature('products')
  @Post('products')
  async create(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>, @Body(new ZodPipe(saveProductSchema)) body: z.output<typeof saveProductSchema>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.catalog.saveProduct(user, q.outletId, body);
  }

  @RequireFeature('products')
  @Put('products/:id')
  async update(
    @CurrentUser() user: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodPipe(outletQuery)) q: z.infer<typeof outletQuery>,
    @Body(new ZodPipe(saveProductSchema)) body: z.output<typeof saveProductSchema>,
  ) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.catalog.saveProduct(user, q.outletId, body, id);
  }
}
