import { z } from 'zod';
import { employeeRoleSchema } from './roles.js';
import { pinSchema } from './auth.js';

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;
export const WEEKDAY_SHORT_ID: Record<Weekday, string> = {
  MON: 'Sn', TUE: 'Sl', WED: 'Rb', THU: 'Km', FRI: 'Jm', SAT: 'Sb', SUN: 'Mg',
};

export const businessSetupSchema = z.object({
  businessName: z.string().trim().min(2, 'Nama usaha terlalu pendek').max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, 'Nomor telepon tidak valid'),
  address: z.string().trim().min(5, 'Alamat terlalu pendek').max(300),
  employeeCount: z.coerce.number().int().min(0).max(1000),
});
export type BusinessSetupInput = z.input<typeof businessSetupSchema>;

export const outletSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
});
export type Outlet = z.infer<typeof outletSchema>;

export const createOutletSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(300).optional(),
});
export type CreateOutletInput = z.infer<typeof createOutletSchema>;

export const createEmployeeSchema = z.object({
  outletId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nama terlalu pendek').max(100),
  role: employeeRoleSchema,
  pin: pinSchema,
  shiftDays: z.array(weekdaySchema).min(1, 'Pilih minimal satu hari kerja'),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ outletId: true })
  .partial()
  .extend({ active: z.boolean().optional() });
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const employeeSchema = z.object({
  id: z.string().uuid(),
  outletId: z.string().uuid(),
  name: z.string(),
  role: employeeRoleSchema,
  shiftDays: z.array(weekdaySchema),
  active: z.boolean(),
});
export type Employee = z.infer<typeof employeeSchema>;

/** What the shared-device login screen needs: names only, no PIN data. */
export const employeeLoginOptionSchema = employeeSchema.pick({ id: true, name: true, role: true });
export type EmployeeLoginOption = z.infer<typeof employeeLoginOptionSchema>;
