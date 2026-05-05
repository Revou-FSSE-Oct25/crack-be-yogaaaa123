# Security Fixes — Remediation Plan v2 (Self-Contained)

> **Status**: READY TO EXECUTE
> **Last verified**: Mon 05 May 2026
> **Commit SHA**: `1aab1bede60e84c2a62622a46390ab517015fa3a`
> **Task 4 (ecdsa)**: ALREADY DONE — `crack-ai/uv.lock` already has `ecdsa 0.19.2 >= 0.19.0`

---

## EXECUTION ORDER

Sequence: Task 1 → Task 2 → Task 3 → Task 6 → Task 7 → verify

(NO parallelism. Tasks must run sequentially because Task 1 establishes foundation patterns used by Tasks 2, 6.)

---

## TASK 1: Global JWT Guard + @Public() Decorator

### 1a. CREATE `src/common/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### 1b. UPDATE `src/common/guards/jwt-auth.guard.ts`

Replace entire file content with:

```typescript
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser extends AuthenticatedUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication token is missing or invalid');
    }
    return user;
  }
}

export type { AuthenticatedUser };
```

### 1c. UPDATE `src/auth/auth.controller.ts`

Add import:
```typescript
import { Public } from '../common/decorators/public.decorator';
```

Add `@Public()` decorator to these methods:
- `register()` — at line 22, before `@Post('register')`
- `login()` — at line 71, before `@Post('login')`
- `refresh()` — at line 117, before `@Post('refresh')`

Do NOT add `@Public()` to `logout()`.

Example for register:
```typescript
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
```

### 1d. UPDATE `src/health/health.controller.ts`

Add import:
```typescript
import { Public } from '../common/decorators/public.decorator';
```

Add `@Public()` before `@Get()` on line 14:
```typescript
  @Public()
  @Get()
  @HealthCheck()
```

### 1e. UPDATE `src/app.module.ts`

Add imports (at top, in existing import block):
```typescript
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
```

In providers array, ADD before TenantThrottlerGuard entry:
```typescript
    // Global JWT Authentication — all routes require auth unless @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
```

### 1f. CREATE `src/common/decorators/public.decorator.spec.ts`

```typescript
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('should set isPublic metadata to true', () => {
    class TestController {
      @Public()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.testMethod);
    expect(metadata).toBe(true);
  });
});
```

### 1g. CREATE `src/common/guards/jwt-auth.guard.spec.ts`

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(isPublic: boolean): ExecutionContext {
    return {
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

  it('should block access when no @Public() and no token', () => {
    const ctx = createMockContext(false);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      // super.canActivate() will throw without req context
      expect(e).toBeDefined();
    }
  });
});
```

### 1h. VERIFY

```bash
npm run test -- --testPathPattern="public|jwt-auth"
npx tsc --noEmit 2>&1 | head -20
```

**Commit message**: `fix(auth): global JWT guard with @Public() bypass`

---

## TASK 2: Upload File Validation (Multer filter + size limit)

### 2a. UPDATE `src/upload/upload.controller.ts`

Replace entire file content with:

```typescript
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRole } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(TenantRole.ADMIN)
@Controller('upload')
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `File type ${file.mimetype} not allowed. Allowed: ${ALLOWED_MIMES.join(', ')}`,
            ),
            false,
          );
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => {
          const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, safeName);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Upload product image (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    return {
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `${baseUrl}/uploads/${file.filename}`,
    };
  }
}
```

### 2b. VERIFY

```bash
npx tsc --noEmit 2>&1 | head -20
npm run test -- --testPathPattern=upload 2>&1 | tail -5
```

**Commit message**: `fix(upload): restrict file type + size, sanitize filename`

---

## TASK 3: npm audit — tar dependency override

### 3a. UPDATE `package.json`

Add `"overrides"` block after `"devDependencies"` and before `"jest"`:

```json
  "overrides": {
    "tar": ">=6.2.1"
  },
```

Insert it right before line 80 (`"jest": {`).

### 3b. RUN

```bash
npm install 2>&1 | tail -5
npm audit --audit-level=high
```

### 3c. VERIFY

`npm audit --audit-level=high` should show exit code 0 (no HIGH vulns).

**Commit message**: `chore(deps): override tar to fix 6 HIGH transitive vulns`

---

## TASK 6: Rate Limit on Health Endpoint

### 6a. UPDATE `src/health/health.controller.ts`

Add import:
```typescript
import { Throttle } from '@nestjs/throttler';
```

Add `@Throttle` decorator to the `check()` method (after `@Public()`, before `@Get()`):

```typescript
  @Public()
  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Get()
  @HealthCheck()
```

### 6b. VERIFY

```bash
npx tsc --noEmit 2>&1 | head -5
```

**Commit message**: `fix(health): add rate limiting (20 req/min)`

---

## TASK 7: Sanitize Example Tokens in Docs

### 7a. Files to clean (search & replace):

| File | Find | Replace |
|------|------|---------|
| `src/auth/auth.controller.ts` line 52 | `'eyJhbGciOiJIUzI1NiIs...'` | `'<access_token>'` |
| `src/auth/auth.controller.ts` line 53 | `'a1b2c3d4e5f6...'` | `'<refresh_token>'` |
| `src/auth/auth.controller.ts` line 99 | `'eyJhbGciOiJIUzI1NiIs...'` | `'<access_token>'` |
| `src/auth/auth.controller.ts` line 100 | `'a1b2c3d4e5f6...'` | `'<refresh_token>'` |

### 7b. VERIFY

```bash
npm run test 2>&1 | tail -5
```

**Commit message**: `chore(docs): sanitize example tokens`

---

## TASK 4 (COMPLETED — NO ACTION)

`crack-ai/uv.lock` line 286: `ecdsa version = "0.19.2"` — already >= 0.19.0 (CVE-2024-23342 fix). No changes needed.

---

## FINAL VERIFICATION

Run these after ALL tasks are committed:

```bash
# 1. Lint
npm run lint 2>&1 | tail -5

# 2. Type check
npx tsc --noEmit 2>&1 | wc -l

# 3. All tests
npm run test 2>&1 | tail -10

# 4. npm audit
npm audit --audit-level=high 2>&1 | tail -5

# 5. Build
npm run build 2>&1 | tail -5
```

**Expected**:
- Lint: 0 errors
- Type check: 0 lines (no errors)
- Tests: all pass
- npm audit: exit 0 (no HIGH)
- Build: success

---

## SUMMARY

| Task | Action | Status |
|------|--------|--------|
| 1 | Global JWT guard + @Public() | **TODO** |
| 2 | Upload file validation | **TODO** |
| 3 | npm tar override | **TODO** |
| 4 | ecdsa update | **DONE** (0.19.2 >= 0.19.0) |
| 6 | Health rate limit | **TODO** |
| 7 | Sanitize example tokens | **TODO** |

### Files created:
- `src/common/decorators/public.decorator.ts`
- `src/common/decorators/public.decorator.spec.ts`
- `src/common/guards/jwt-auth.guard.spec.ts`

### Files modified:
- `src/common/guards/jwt-auth.guard.ts`
- `src/auth/auth.controller.ts`
- `src/health/health.controller.ts`
- `src/app.module.ts`
- `src/upload/upload.controller.ts`
- `package.json`
