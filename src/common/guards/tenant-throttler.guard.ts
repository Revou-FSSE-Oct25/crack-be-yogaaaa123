import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string; tenantId?: string } | undefined;

    if (user?.id) {
      return `user:${user.id}`;
    }

    if (user?.tenantId) {
      return `tenant:${user.tenantId}`;
    }

    return `ip:${req.ip as string}`;
  }
}
