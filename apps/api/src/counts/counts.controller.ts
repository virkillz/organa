import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import { countLinesSchema, startCountSchema } from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, RequireFeature } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from '../tenant/tenant.service.js';
import { CountsService } from './counts.service.js';

const latestQuery = z.object({ outletId: z.string().uuid(), categoryId: z.string().uuid().optional() });

@RequireFeature('stockCount')
@Controller({ path: 'stock-counts', version: '1' })
export class CountsController {
  constructor(
    @Inject(CountsService) private readonly counts: CountsService,
    @Inject(TenantService) private readonly tenants: TenantService,
  ) {}

  @Post()
  async start(@CurrentUser() user: AccessClaims, @Body(new ZodPipe(startCountSchema)) body: z.infer<typeof startCountSchema>) {
    await this.tenants.assertOutlet(user, body.outletId);
    return this.counts.start(user, body.outletId, body.categoryId);
  }

  @Get('latest')
  async latest(@CurrentUser() user: AccessClaims, @Query(new ZodPipe(latestQuery)) q: z.infer<typeof latestQuery>) {
    await this.tenants.assertOutlet(user, q.outletId);
    return { count: await this.counts.latest(user, q.outletId, q.categoryId) };
  }

  @Get(':id')
  get(@CurrentUser() user: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.get(user, id);
  }

  @Put(':id/lines')
  saveLines(@CurrentUser() user: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(countLinesSchema)) body: z.infer<typeof countLinesSchema>) {
    return this.counts.saveLines(user, id, body);
  }

  @Post(':id/commit')
  commit(@CurrentUser() user: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.counts.commit(user, id);
  }
}
