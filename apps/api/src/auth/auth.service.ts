import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccessClaims,
  AuthTokens,
  EmployeeLoginInput,
  EmployeeLoginOption,
  OtpChallenge,
  OtpVerifyInput,
  RegisterOwnerInput,
  ownerLoginSchema,
  SessionUser,
} from '@organa/shared';
import { z } from 'zod';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { hashSecret, randomDigits, randomToken, sha256, verifySecret } from '../common/crypto.js';
import { DB, type Db } from '../db/db.module.js';
import { devices, employees, otpChallenges, outlets, refreshTokens, tenants, users } from '../db/schema.js';
import { maskEmail, maskPhone, OtpSender } from './otp.sender.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 5 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;
export const DEMO_OTP = '123456';

type Subject = { kind: 'owner' | 'employee'; id: string };

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so timing does not reveal which emails exist. */
  private readonly dummyHash = hashSecret(randomToken());

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(OtpSender) private readonly otp: OtpSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async registerOwner(input: RegisterOwnerInput): Promise<AuthTokens> {
    const passwordHash = await hashSecret(input.password);
    const userId = await this.db.transaction(async (tx) => {
      const existing = await tx.query.users.findFirst({ where: eq(users.email, input.email) });
      if (existing) throw new ConflictException('Email sudah terdaftar');
      const [tenant] = await tx.insert(tenants).values({}).returning({ id: tenants.id });
      const [user] = await tx
        .insert(users)
        .values({ tenantId: tenant!.id, fullName: input.fullName, email: input.email, passwordHash })
        .returning({ id: users.id });
      return user!.id;
    });
    return this.issueTokens({ kind: 'owner', id: userId });
  }

  async startOwnerLogin(input: z.output<typeof ownerLoginSchema>): Promise<OtpChallenge> {
    const user = await this.db.query.users.findFirst({ where: eq(users.email, input.email) });
    const ok = await verifySecret(input.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !ok) throw new UnauthorizedException('Email atau password salah');

    const code = this.config.DEMO_MODE ? DEMO_OTP : randomDigits(6);
    const [challenge] = await this.db
      .insert(otpChallenges)
      .values({
        userId: user.id,
        channel: input.otpChannel,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      })
      .returning({ id: otpChallenges.id });
    // Phone channels go to the business phone; before business setup there is none, so fall back to email.
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, user.tenantId) });
    const usePhone = input.otpChannel !== 'EMAIL' && !!tenant?.phone;
    const channel = usePhone ? input.otpChannel : 'EMAIL';
    const destination = usePhone ? tenant!.phone! : user.email;
    await this.otp.send(channel, destination, code);
    return {
      challengeId: challenge!.id,
      channel,
      destination: usePhone ? maskPhone(destination) : maskEmail(destination),
    };
  }

  async verifyOtp(input: OtpVerifyInput): Promise<AuthTokens> {
    const challenge = await this.db.query.otpChallenges.findFirst({
      where: and(
        eq(otpChallenges.id, input.challengeId),
        isNull(otpChallenges.consumedAt),
        gt(otpChallenges.expiresAt, new Date()),
      ),
    });
    if (!challenge || challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Kode OTP kedaluwarsa, silakan login ulang');
    }
    if (sha256(input.code) !== challenge.codeHash) {
      await this.db
        .update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      throw new UnauthorizedException('Kode OTP salah');
    }
    await this.db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challenge.id));
    return this.issueTokens({ kind: 'owner', id: challenge.userId });
  }

  /** Binds a shared phone/tablet to an outlet so employees can log in on it with a PIN. */
  async registerDevice(claims: AccessClaims, outletId: string, name?: string): Promise<{ deviceToken: string }> {
    const outlet = await this.db.query.outlets.findFirst({
      where: and(eq(outlets.id, outletId), eq(outlets.tenantId, claims.tid)),
    });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');
    const deviceToken = randomToken();
    await this.db
      .insert(devices)
      .values({ tenantId: claims.tid, outletId, name, tokenHash: sha256(deviceToken) });
    return { deviceToken };
  }

  async listDeviceEmployees(deviceToken: string | undefined): Promise<EmployeeLoginOption[]> {
    const device = await this.findDevice(deviceToken);
    return this.db
      .select({ id: employees.id, name: employees.name, role: employees.role })
      .from(employees)
      .where(and(eq(employees.outletId, device.outletId), eq(employees.active, true)))
      .orderBy(asc(employees.name));
  }

  async employeeLogin(deviceToken: string | undefined, input: EmployeeLoginInput): Promise<AuthTokens> {
    const device = await this.findDevice(deviceToken);
    const employee = await this.db.query.employees.findFirst({
      where: and(
        eq(employees.id, input.employeeId),
        eq(employees.outletId, device.outletId),
        eq(employees.active, true),
      ),
    });
    if (!employee) throw new UnauthorizedException('Karyawan tidak ditemukan');
    if (employee.lockedUntil && employee.lockedUntil > new Date()) {
      throw new HttpException('Terlalu banyak percobaan. Coba lagi dalam 5 menit.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await verifySecret(input.pin, employee.pinHash))) {
      const attempts = employee.failedPinAttempts + 1;
      const locked = attempts >= PIN_MAX_ATTEMPTS;
      await this.db
        .update(employees)
        .set({
          failedPinAttempts: locked ? 0 : attempts,
          lockedUntil: locked ? new Date(Date.now() + PIN_LOCK_MS) : null,
        })
        .where(eq(employees.id, employee.id));
      throw new UnauthorizedException('Kode unik salah');
    }
    if (employee.failedPinAttempts > 0 || employee.lockedUntil) {
      await this.db
        .update(employees)
        .set({ failedPinAttempts: 0, lockedUntil: null })
        .where(eq(employees.id, employee.id));
    }
    return this.issueTokens({ kind: 'employee', id: employee.id });
  }

  /** Rotates the refresh token: the presented one is revoked and a new pair is issued. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const [row] = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, sha256(refreshToken)),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!row) throw new UnauthorizedException();
    return this.issueTokens({ kind: row.subjectKind, id: row.subjectId });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
  }

  async sessionUser(subject: Subject): Promise<SessionUser> {
    if (subject.kind === 'owner') {
      const row = await this.db
        .select({ user: users, tenant: tenants })
        .from(users)
        .innerJoin(tenants, eq(tenants.id, users.tenantId))
        .where(eq(users.id, subject.id))
        .then((r) => r[0]);
      if (!row) throw new UnauthorizedException();
      const outletRows = await this.db
        .select({ id: outlets.id })
        .from(outlets)
        .where(eq(outlets.tenantId, row.tenant.id))
        .orderBy(asc(outlets.createdAt));
      return {
        id: row.user.id,
        kind: 'owner',
        name: row.user.fullName,
        role: 'OWNER',
        tenantId: row.tenant.id,
        tenantName: row.tenant.name,
        plan: row.tenant.plan,
        outletIds: outletRows.map((o) => o.id),
        needsBusinessSetup: row.tenant.name === null,
      };
    }
    const row = await this.db
      .select({ employee: employees, tenant: tenants })
      .from(employees)
      .innerJoin(tenants, eq(tenants.id, employees.tenantId))
      .where(and(eq(employees.id, subject.id), eq(employees.active, true)))
      .then((r) => r[0]);
    if (!row) throw new ForbiddenException('Akun karyawan tidak aktif');
    return {
      id: row.employee.id,
      kind: 'employee',
      name: row.employee.name,
      role: row.employee.role,
      tenantId: row.tenant.id,
      tenantName: row.tenant.name,
      plan: row.tenant.plan,
      outletIds: [row.employee.outletId],
      needsBusinessSetup: false,
    };
  }

  private async issueTokens(subject: Subject): Promise<AuthTokens> {
    const user = await this.sessionUser(subject);
    const claims: AccessClaims = {
      sub: user.id,
      kind: user.kind,
      role: user.role,
      tid: user.tenantId,
      name: user.name,
      ...(user.kind === 'employee' ? { oid: user.outletIds[0] } : {}),
    };
    const accessToken = await this.jwt.signAsync(claims);
    const refreshToken = randomToken();
    await this.db.insert(refreshTokens).values({
      tenantId: user.tenantId,
      subjectKind: subject.kind,
      subjectId: subject.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return { accessToken, refreshToken, user };
  }

  private async findDevice(deviceToken: string | undefined) {
    if (!deviceToken) throw new UnauthorizedException('Perangkat belum terdaftar');
    const device = await this.db.query.devices.findFirst({
      where: and(eq(devices.tokenHash, sha256(deviceToken)), isNull(devices.revokedAt)),
    });
    if (!device) throw new UnauthorizedException('Perangkat belum terdaftar');
    return device;
  }
}
