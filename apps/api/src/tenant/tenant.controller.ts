import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import {
  businessSetupSchema,
  createEmployeeSchema,
  createOutletSchema,
  updateEmployeeSchema,
} from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, OwnerOnly } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { TenantService } from './tenant.service.js';

const outletQuerySchema = z.object({ outletId: z.string().uuid().optional() });

@Controller({ version: '1' })
export class TenantController {
  constructor(@Inject(TenantService) private readonly tenants: TenantService) {}

  @Get('tenant')
  getTenant(@CurrentUser() user: AccessClaims) {
    return this.tenants.getTenant(user);
  }

  @OwnerOnly()
  @Put('tenant/setup')
  setup(
    @CurrentUser() user: AccessClaims,
    @Body(new ZodPipe(businessSetupSchema)) body: z.output<typeof businessSetupSchema>,
  ) {
    return this.tenants.setupBusiness(user, body);
  }

  @Get('outlets')
  listOutlets(@CurrentUser() user: AccessClaims) {
    return this.tenants.listOutlets(user);
  }

  @OwnerOnly()
  @Post('outlets')
  createOutlet(
    @CurrentUser() user: AccessClaims,
    @Body(new ZodPipe(createOutletSchema)) body: z.infer<typeof createOutletSchema>,
  ) {
    return this.tenants.createOutlet(user, body);
  }

  @OwnerOnly()
  @Get('employees')
  listEmployees(
    @CurrentUser() user: AccessClaims,
    @Query(new ZodPipe(outletQuerySchema)) query: z.infer<typeof outletQuerySchema>,
  ) {
    return this.tenants.listEmployees(user, query.outletId);
  }

  @OwnerOnly()
  @Post('employees')
  createEmployee(
    @CurrentUser() user: AccessClaims,
    @Body(new ZodPipe(createEmployeeSchema)) body: z.infer<typeof createEmployeeSchema>,
  ) {
    return this.tenants.createEmployee(user, body);
  }

  @OwnerOnly()
  @Patch('employees/:id')
  updateEmployee(
    @CurrentUser() user: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateEmployeeSchema)) body: z.infer<typeof updateEmployeeSchema>,
  ) {
    return this.tenants.updateEmployee(user, id, body);
  }
}
