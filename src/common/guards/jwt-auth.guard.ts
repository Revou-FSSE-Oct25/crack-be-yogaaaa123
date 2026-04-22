import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw (
        (err as Error) ??
        new UnauthorizedException('Authentication token is missing or invalid')
      );
    }
    return user as TUser;
  }
}

// Re-export the type so consumers can use it without importing separately
export type { AuthenticatedUser };
