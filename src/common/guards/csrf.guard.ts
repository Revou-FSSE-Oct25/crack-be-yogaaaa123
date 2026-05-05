import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip CSRF for @Public() routes (login, register, refresh, health)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // GET/HEAD/OPTIONS — no CSRF check needed
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

    // Double-submit cookie pattern
    const csrfCookie = request.cookies?.['csrf_token'];
    const csrfHeader = request.headers['x-csrf-token'] as string | undefined;

    if (!csrfCookie || !csrfHeader) {
      throw new ForbiddenException('CSRF token missing');
    }
    if (csrfCookie !== csrfHeader) {
      throw new ForbiddenException('CSRF token mismatch');
    }
    return true;
  }
}
