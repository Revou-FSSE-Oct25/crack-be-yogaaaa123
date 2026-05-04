import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * TenantThrottlerGuard — Multi-tenant Rate Limiting
 *
 * PROBLEM:
 * The default ThrottlerGuard throttles by IP address. In a multi-tenant SaaS,
 * one tenant with high traffic can exhaust the global rate limit, causing
 * "Noisy Neighbor" issues where other tenants are throttled unfairly.
 *
 * SOLUTION:
 * This guard throttles by `tenantId` instead of IP address. Each tenant gets
 * their own rate limit bucket, so high traffic from one tenant doesn't affect
 * others.
 *
 * HOW IT WORKS:
 * - If the user is authenticated (has tenantId), use `tenantId:userId` as the
 *   throttler tracker
 * - If the user is not authenticated (e.g., login page), fall back to IP address
 * - This ensures fair resource distribution across all tenants
 *
 * USAGE:
 *   // In app.module.ts:
 *   {
 *     provide: APP_GUARD,
 *     useClass: TenantThrottlerGuard,
 *   }
 *
 *   // Or per-controller:
 *   @UseGuards(TenantThrottlerGuard)
 *
 * RATE LIMITS (configured in ThrottlerModule.forRoot()):
 *   - Global: 60 requests per 60 seconds per tenant
 *   - Auth: 10 requests per 60 seconds per IP (unauthenticated)
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  /**
   * Generate a unique tracker string for rate limiting.
   *
   * Priority:
   * 1. Authenticated user: `tenantId:userId` (tenant-aware)
   * 2. Unauthenticated: `ip:user-agent` (fallback)
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // If user is authenticated, use tenantId as the primary tracker
    const user = req.user as { id?: string; tenantId?: string } | undefined;

    if (user?.tenantId) {
      // Use tenantId as the primary throttling key
      // This ensures each tenant gets their own rate limit bucket
      return `tenant:${user.tenantId}`;
    }

    // Fallback to IP-based throttling for unauthenticated requests
    return `ip:${req.ip as string}`;
  }
}
