import { z } from 'zod';

export const ROLES = ['OWNER', 'HEAD_CHEF', 'CASHIER'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Roles an owner can assign to an employee. */
export const EMPLOYEE_ROLES = ['HEAD_CHEF', 'CASHIER'] as const;
export const employeeRoleSchema = z.enum(EMPLOYEE_ROLES);
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Pemilik',
  HEAD_CHEF: 'Kepala Dapur',
  CASHIER: 'Kasir',
};

/** Feature areas used by both the API guards and the app drawer. */
export const FEATURES = ['products', 'stock', 'stockCount', 'analysis', 'forecast', 'pos', 'settings'] as const;
export type Feature = (typeof FEATURES)[number];

export const ROLE_FEATURES: Record<Role, readonly Feature[]> = {
  OWNER: FEATURES,
  HEAD_CHEF: ['products', 'stock', 'stockCount', 'analysis', 'forecast'],
  CASHIER: ['pos'],
};

export function canAccess(role: Role, feature: Feature): boolean {
  return ROLE_FEATURES[role].includes(feature);
}
