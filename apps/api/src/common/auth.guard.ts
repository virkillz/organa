import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccessClaims, canAccess, Feature } from '@organa/shared';

const PUBLIC_KEY = 'organa:public';
const FEATURE_KEY = 'organa:feature';
const OWNER_ONLY_KEY = 'organa:ownerOnly';

/** Skips access-token auth (login, register, device-authenticated routes). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Requires the caller's role to include this feature (see ROLE_FEATURES). */
export const RequireFeature = (feature: Feature) => SetMetadata(FEATURE_KEY, feature);
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessClaims => ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();

    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims & object>(token);
    } catch {
      throw new UnauthorizedException();
    }
    req.user = claims;

    if (this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, targets) && claims.role !== 'OWNER') {
      throw new ForbiddenException();
    }
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(FEATURE_KEY, targets);
    if (feature && !canAccess(claims.role, feature)) throw new ForbiddenException();
    return true;
  }
}
