import { z } from 'zod';
import { roleSchema } from './roles.js';

export const OTP_CHANNELS = ['EMAIL', 'WHATSAPP', 'SMS', 'MISSED_CALL'] as const;
export const otpChannelSchema = z.enum(OTP_CHANNELS);
export type OtpChannel = z.infer<typeof otpChannelSchema>;

const email = z.string().trim().toLowerCase().pipe(z.email('Email tidak valid'));
const password = z.string().min(8, 'Password minimal 8 karakter').max(128);
export const pinSchema = z.string().regex(/^\d{6}$/, 'Kode unik harus 6 digit');

export const registerOwnerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama terlalu pendek').max(100),
  email,
  password,
});
export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>;

export const ownerLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Password wajib diisi'),
  otpChannel: otpChannelSchema.default('EMAIL'),
});
export type OwnerLoginInput = z.input<typeof ownerLoginSchema>;

export const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit'),
  deviceName: z.string().max(100).optional(),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const employeeLoginSchema = z.object({
  employeeId: z.string().uuid(),
  pin: pinSchema,
});
export type EmployeeLoginInput = z.infer<typeof employeeLoginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const otpChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  channel: otpChannelSchema,
  /** Masked destination, e.g. "el***@hotmail.com". */
  destination: z.string(),
});
export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['owner', 'employee']),
  name: z.string(),
  role: roleSchema,
  tenantId: z.string().uuid(),
  tenantName: z.string().nullable(),
  plan: z.enum(['LITE', 'PREMIUM']),
  /** Outlets the user can act in; employees have exactly one. */
  outletIds: z.array(z.string().uuid()),
  needsBusinessSetup: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: sessionUserSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/** Claims carried in the access token. */
export interface AccessClaims {
  sub: string;
  kind: 'owner' | 'employee';
  role: z.infer<typeof roleSchema>;
  tid: string;
  /** Display name, recorded as "entered by" on stock records. */
  name: string;
  /** Outlet the employee is bound to; undefined for owners. */
  oid?: string;
}
