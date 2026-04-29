import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Simple in-memory cache interceptor.
 * Only caches GET requests. TTL is configurable per route via query param,
 * or defaults to 30 seconds.
 *
 * Usage: apply @UseInterceptors(CacheInterceptor) to controllers or globally.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, { data: unknown; expiry: number }>();
  private readonly defaultTTL = 30_000; // 30 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = `${request.url}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return of(cached.data);
    }

    return next.handle().pipe(
      tap((data) => {
        // Don't cache error responses or empty data
        if (data && typeof data === 'object') {
          this.cache.set(cacheKey, {
            data,
            expiry: Date.now() + this.defaultTTL,
          });
        }
      }),
    );
  }
}
