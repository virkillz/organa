import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import { createOrderSchema } from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, RequireFeature } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from '../tenant/tenant.service.js';
import { PosService } from './pos.service.js';

const listQuery = z.object({ outletId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

@Controller({ path: 'orders', version: '1' })
export class PosController {
  constructor(
    @Inject(PosService) private readonly pos: PosService,
    @Inject(TenantService) private readonly tenants: TenantService,
  ) {}

  @RequireFeature('pos')
  @Post()
  async create(@CurrentUser() user: AccessClaims, @Body(new ZodPipe(createOrderSchema)) body: z.infer<typeof createOrderSchema>) {
    await this.tenants.assertOutlet(user, body.outletId);
    return this.pos.createOrder(user, body);
  }

  @RequireFeature('pos')
  @Get()
  async list(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return this.pos.listOrders(user, q.outletId, q.date);
  }
}
