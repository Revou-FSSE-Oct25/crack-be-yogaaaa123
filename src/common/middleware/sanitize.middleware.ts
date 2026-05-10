import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .trim();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitizeValue(v));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.sanitizeValue(v)]));
    }
    return value;
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      req.body = this.sanitizeValue(req.body);
    }
    next();
  }
}
