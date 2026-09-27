import { Body, Controller, Get, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import type { AccessClaims } from '@organa/shared';
import {
  employeeLoginSchema,
  otpVerifySchema,
  ownerLoginSchema,
  refreshSchema,
  registerOwnerSchema,
} from '@organa/shared';
import { z } from 'zod';
import { CurrentUser, OwnerOnly, Public } from '../common/auth.guard.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuthService } from './auth.service.js';

const DEVICE_HEADER = 'x-device-token';
const registerDeviceSchema = z.object({
  outletId: z.string().uuid(),
  name: z.string().max(100).optional(),
});

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodPipe(registerOwnerSchema)) body: z.infer<typeof registerOwnerSchema>) {
    return this.auth.registerOwner(body);
  }

  @Public()
  @Post('owner/login')
  @HttpCode(200)
  ownerLogin(@Body(new ZodPipe(ownerLoginSchema)) body: z.output<typeof ownerLoginSchema>) {
    return this.auth.startOwnerLogin(body);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body(new ZodPipe(otpVerifySchema)) body: z.infer<typeof otpVerifySchema>) {
    return this.auth.verifyOtp(body);
  }

  @Public()
  @Get('employees')
  deviceEmployees(@Headers(DEVICE_HEADER) deviceToken?: string) {
    return this.auth.listDeviceEmployees(deviceToken);
  }

  @Public()
  @Post('employee/login')
  @HttpCode(200)
  employeeLogin(
    @Headers(DEVICE_HEADER) deviceToken: string | undefined,
    @Body(new ZodPipe(employeeLoginSchema)) body: z.infer<typeof employeeLoginSchema>,
  ) {
    return this.auth.employeeLogin(deviceToken, body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AccessClaims) {
    return this.auth.sessionUser({ kind: user.kind, id: user.sub });
  }

  @OwnerOnly()
  @Post('devices')
  registerDevice(
    @CurrentUser() user: AccessClaims,
    @Body(new ZodPipe(registerDeviceSchema)) body: z.infer<typeof registerDeviceSchema>,
  ) {
    return this.auth.registerDevice(user, body.outletId, body.name);
  }
}
