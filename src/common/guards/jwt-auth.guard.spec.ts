import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

jest.mock('@nestjs/passport', () => {
  const actual = jest.requireActual('@nestjs/passport');
  return {
    ...actual,
    AuthGuard: jest.fn().mockImplementation((name: string) => {
      return class {
        canActivate() {
          return true;
        }
      };
    }),
  };
});

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(isPublic: boolean): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
      getHandler: () => {
        const handler = function () {};
        if (isPublic) {
          Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
        }
        return handler;
      },
      getClass: () => {
        const cls = function TestController() {};
        return cls;
      },
    } as unknown as ExecutionContext;
  }

  it('should allow access when @Public() is set', () => {
    const ctx = createMockContext(true);
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should delegate to super when no @Public() is set', () => {
    const ctx = createMockContext(false);
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
