import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccessClaims,
  CreateEmployeeInput,
  CreateOutletInput,
  Employee,
  Outlet,
  UpdateEmployeeInput,
  businessSetupSchema,
} from '@organa/shared';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashSecret } from '../common/crypto.js';
import { DB, type Db } from '../db/db.module.js';
import { employees, outlets, tenants } from '../db/schema.js';

const employeeColumns = {
  id: employees.id,
  outletId: employees.outletId,
  name: employees.name,
  role: employees.role,
  shiftDays: employees.shiftDays,
  active: employees.active,
};

@Injectable()
export class TenantService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getTenant(claims: AccessClaims) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, claims.tid) });
    if (!tenant) throw new NotFoundException();
    return tenant;
  }

  /** Saves the business profile. The first call also creates the first outlet, "Cabang 1". */
  async setupBusiness(claims: AccessClaims, input: z.output<typeof businessSetupSchema>) {
    return this.db.transaction(async (tx) => {
      const [tenant] = await tx
        .update(tenants)
        .set({
          name: input.businessName,
          phone: input.phone,
          address: input.address,
          employeeCount: input.employeeCount,
        })
        .where(eq(tenants.id, claims.tid))
        .returning();
      const existing = await tx.select({ id: outlets.id }).from(outlets).where(eq(outlets.tenantId, claims.tid));
      if (existing.length === 0) {
        await tx.insert(outlets).values({ tenantId: claims.tid, name: 'Cabang 1', address: input.address });
      }
      return tenant!;
    });
  }

  listOutlets(claims: AccessClaims): Promise<Outlet[]> {
    return this.db
      .select({ id: outlets.id, name: outlets.name, address: outlets.address })
      .from(outlets)
      .where(
        claims.oid
          ? and(eq(outlets.tenantId, claims.tid), eq(outlets.id, claims.oid))
          : eq(outlets.tenantId, claims.tid),
      )
      .orderBy(asc(outlets.createdAt));
  }

  async createOutlet(claims: AccessClaims, input: CreateOutletInput): Promise<Outlet> {
    const [row] = await this.db
      .insert(outlets)
      .values({ tenantId: claims.tid, name: input.name, address: input.address })
      .returning({ id: outlets.id, name: outlets.name, address: outlets.address });
    return row!;
  }

  /**
   * Checks the caller may act in the outlet: owners in any outlet of their tenant,
   * employees only in their own.
   */
  async assertOutlet(claims: AccessClaims, outletId: string): Promise<void> {
    if (claims.oid && claims.oid !== outletId) throw new ForbiddenException();
    const outlet = await this.db.query.outlets.findFirst({
      where: and(eq(outlets.id, outletId), eq(outlets.tenantId, claims.tid)),
    });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');
  }

  async listEmployees(claims: AccessClaims, outletId?: string): Promise<Employee[]> {
    if (outletId) await this.assertOutlet(claims, outletId);
    return this.db
      .select(employeeColumns)
      .from(employees)
      .where(
        outletId
          ? and(eq(employees.tenantId, claims.tid), eq(employees.outletId, outletId))
          : eq(employees.tenantId, claims.tid),
      )
      .orderBy(asc(employees.name));
  }

  async createEmployee(claims: AccessClaims, input: CreateEmployeeInput): Promise<Employee> {
    await this.assertOutlet(claims, input.outletId);
    const [row] = await this.db
      .insert(employees)
      .values({
        tenantId: claims.tid,
        outletId: input.outletId,
        name: input.name,
        role: input.role,
        pinHash: await hashSecret(input.pin),
        shiftDays: input.shiftDays,
      })
      .returning(employeeColumns);
    return row!;
  }

  async updateEmployee(claims: AccessClaims, id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const { pin, ...rest } = input;
    const [row] = await this.db
      .update(employees)
      .set({
        ...rest,
        ...(pin ? { pinHash: await hashSecret(pin), failedPinAttempts: 0, lockedUntil: null } : {}),
      })
      .where(and(eq(employees.id, id), eq(employees.tenantId, claims.tid)))
      .returning(employeeColumns);
    if (!row) throw new NotFoundException('Karyawan tidak ditemukan');
    return row;
  }
}

