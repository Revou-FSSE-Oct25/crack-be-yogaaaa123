# Cookie-Based Auth Migration

## TL;DR

> **Summary**: Move JWT access+refresh tokens from response body to HttpOnly cookies. No token data in JSON responses. Auth endpoints set/clear cookies via Set-Cookie header instead.

> **Deliverables**:
> - cookie-parser installed + wired in main.ts
> - JWT strategy extracts token from cookie with Authorization header fallback
> - Auth controller sets HttpOnly cookies on login/register/refresh
> - Auth controller clears cookies on logout
> - Auth service returns `{ user }` only (no tokens in body)
> - Swagger docs updated to reflect cookie-based auth
> - FE `apiClient.ts` simplified (was reading cookie → header; now just read cookie)

> **Estimate**: Quick
> **Parallel**: YES — 3 waves
> **Critical Path**: T1 (install+cookieParser) → T2 (JWT strategy) → T3 (controller+service)

---

## Context

### Original Request
Migrate backend auth from `Authorization: Bearer` header-based JWT to HttpOnly cookie-based auth. FE already reads token from a non-httpOnly cookie (`auth_token` in `document.cookie`). Need backend to set this cookie properly as HttpOnly for security (XSS protection).

### Current State
**Backend (NestJS):**
- Login returns `{ access_token, refresh_token, expires_in, user }` in response body
- Register same pattern
- Refresh reads from `x-refresh-token` header  
- Logout protected by JWT guard, reads userId via `@CurrentUser('id')`
- JWT strategy: `ExtractJwt.fromAuthHeaderAsBearerToken()` ONLY
- No cookie-parser installed
- CORS: `credentials: true` already configured
- Global response interceptor wraps all in `{ statusCode, message, data, timestamp }`

**Frontend (Next.js):**
- `middleware.ts:28` — reads `auth_token` cookie for route protection on edge
- `apiClient.ts:27-31` — reads cookie via `document.cookie`, sends as `Authorization: Bearer`
- `useLoginMutation.ts:22` — saves token to non-httpOnly cookie manually via `document.cookie = ...`
- AUTH_TOKEN_KEY = `'auth_token'`
- No refresh token handling on FE (re-logs in on expiry)

### Decisions Made (User-Confirmed)
1. **Both tokens** → HttpOnly cookies (access + refresh)
2. **Response body** → no tokens, return `{ user }` only
3. **Register** → also set cookies (immediate login flow)
4. **Refresh** → read token from cookie, not `x-refresh-token` header

---

## Work Objectives

### Core Objective
Convert backend auth to HttpOnly cookie-based flow — tokens set via Set-Cookie, never in response body.

### Concrete Deliverables
- `src/auth/auth.controller.ts` — login/register/refresh set cookies; logout clears
- `src/auth/auth.service.ts` — return `{ user }` only, no tokens in return
- `src/auth/strategies/jwt.strategy.ts` — extract JWT from cookie with Bearer fallback
- `src/main.ts` — register cookie-parser middleware
- `package.json` — add cookie-parser + @types/cookie-parser

### Must Have
- Access token → HttpOnly cookie named `auth_token`, 15m expiry (matching JWT expiry)
- Refresh token → HttpOnly cookie named `refresh_token`, 7d expiry
- Both cookies: `HttpOnly; Secure (prod); SameSite=Lax; Path=/`
- JWT strategy extracts from `req.cookies.auth_token` first, falls back to `Authorization` header
- `/auth/refresh` reads refresh_token from cookie, not header
- `/auth/login` response: `{ user: {...} }` — no tokens
- `/auth/register` response: `{ message, user: {...} }` — no tokens
- `/auth/logout` clears both cookies
- FE `apiClient.ts` keeps reading cookie (no change needed — already does this)
- FE `useLoginMutation.ts` — remove manual `document.cookie` set (backend handles it now)
- All existing tests pass

### Must Have (CSRF)
- CSRF token endpoint: `GET /auth/csrf-token` — generates random token, sets `csrf_token` cookie (non-httpOnly, JS needs to read it), returns token in body
- CSRF guard: validates `X-CSRF-Token` header matches `csrf_token` cookie on all unsafe methods (POST/PUT/PATCH/DELETE) for authenticated routes
- CSRF exempt: public endpoints (login, register, refresh — they don't have auth cookie yet)
- FE `apiClient.ts`: reads `csrf_token` cookie, attaches `X-CSRF-Token` header on unsafe methods

### Must NOT Have (Guardrails)
- No tokens returned in any response body (login, register, refresh)
- No breaking changes to FE middleware.ts (still reads `auth_token` cookie)
- No breaking changes to other controllers/guards (they use `@CurrentUser` decorator — untouched)
- No changes to Prisma schema, DB migrations, or response interceptor
- No breaking changes to existing JWT Bearer flow (dual-mode: cookie + header fallback)

---

## Verification Strategy

### Test Decision
- **Infrastructure**: YES (Jest + unit tests exist)
- **Automated tests**: YES (tests after — run `npm run test` after migration)
- **Framework**: Jest

### QA Policy
Every task verified by agent via Bash (curl) testing:

- Backend: `curl -v POST /auth/login` → check Set-Cookie header in response, no token in body
- Backend: `curl -v POST /auth/register` → same pattern
- Backend: `curl POST /auth/refresh --cookie refresh_token=...` → new tokens
- Backend: `curl POST /auth/logout --cookie auth_token=...` → cleared cookies
- Backend: `curl GET /dashboard/summary --cookie auth_token=...` → 200 OK
- Backend: `curl GET /dashboard/summary` (no cookie) → 401

---

## Execution Strategy

### Parallel Waves

```
Wave 1 (Start Immediately):
├── T1: Install cookie-parser + register middleware [quick]
├── T2: Update JWT strategy — cookie extraction fallback [quick]
├── T5: Create CSRF token guard + endpoint [quick]

Wave 2 (After Wave 1):
├── T3: Update auth controller + service — set cookies, strip tokens [quick]
├── T4: Update FE useLoginMutation — remove manual cookie set [quick]
├── T6: Update FE apiClient — add X-CSRF-Token header on unsafe methods [quick]

Wave FINAL:
├── F1: Plan compliance audit [oracle]
├── F2: Run tests + build check [unspecified-high]
├── F3: Real QA via curl [unspecified-high]
```

### Dependency Matrix
- T1: — → T2, T3, T5
- T2: T1 → T3, T4
- T3: T1, T2, T5 → F1-F3
- T4: T2 → F3
- T5: T1 → T3, T6
- T6: T2, T5 → F3

---

## TODOs

### T1 — Install cookie-parser + register middleware

**What to do**:
1. `npm install cookie-parser && npm install -D @types/cookie-parser`
2. In `src/main.ts`, add `import * as cookieParser from 'cookie-parser';`
3. Register before helmet: `app.use(cookieParser());` (before helmet for compatibility)
4. Verify no `@nestjs/common` import issues

**Must NOT do**:
- Don't change any config or module structure
- Don't touch NestJS module registration - cookieParser is Express middleware

**Agent Profile**:
- Category: `quick`
- Skills: `[]`

**Parallelization**:
- Can Run In Parallel: YES
- Wave: 1 (with T2)
- Blocks: T2, T3
- Blocked By: None

**References**:
- `src/main.ts` — existing middleware registration pattern (helmet at line 51)
- `@nestjs/common` docs: cookie-parser is standard Express middleware, used via `app.use()`

**Acceptance Criteria**:
- [ ] package.json shows `cookie-parser` in dependencies and `@types/cookie-parser` in devDependencies
- [ ] `npm run build` succeeds
- [ ] `src/main.ts` has `import * as cookieParser from 'cookie-parser'` and `app.use(cookieParser())`

**QA Scenarios**:
```
Scenario: Verify cookie-parser install and build
  Tool: Bash
  Preconditions: npm install completed
  Steps:
    1. npm run build
    2. Check exit code === 0
  Expected: Build succeeds
  Evidence: .sisyphus/evidence/cookie-auth-T1-build.log
```

**Commit**: YES
- Message: `chore(deps): add cookie-parser for HttpOnly cookie auth`
- Files: `package.json`, `package-lock.json`, `src/main.ts`
- Pre-commit: `npm run build`

---

### T5 — Create CSRF token guard + endpoint

**What to do**:

**Backend — `src/common/guards/csrf.guard.ts`:**
Create a new NestJS guard `CsrfGuard` implementing `CanActivate`:

```typescript
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
```

**Backend — `src/common/guards/index.ts`:**
Export CsrfGuard for clean imports.

**Backend — `src/auth/auth.controller.ts`:**
Add a new endpoint:
```typescript
@Public()
@Get('csrf-token')
@ApiOperation({ summary: 'Get CSRF token (double-submit cookie pattern)' })
getCsrfToken(@Res({ passthrough: true }) res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', token, {
    httpOnly: false,     // JS needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  return { csrf_token: token };
}
```
Import `crypto` from `node:crypto` at the top of the controller file.

**Backend — `src/app.module.ts`:**
Register CsrfGuard as a global guard:
```typescript
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard';

// In providers array:
{
  provide: APP_GUARD,
  useClass: CsrfGuard,
},
```

Note: Order matters — CsrfGuard runs BEFORE JwtAuthGuard for public routes (CsrfGuard skips via @Public decorator), and AFTER JwtAuthGuard for protected routes (CsrfGuard validates X-CSRF-Token).

**Must NOT do**:
- Don't add CSRF check to public routes (login, register, refresh, health)
- Don't make csrf_token httpOnly — FE needs to read it via document.cookie
- Don't change existing guards or their order

**Agent Profile**:
- Category: `quick`
- Skills: `[]`

**Parallelization**:
- Can Run In Parallel: YES
- Wave: 1 (with T1, T2)
- Blocks: T3, T6
- Blocked By: T1

**References**:
- `src/common/guards/jwt-auth.guard.ts` — existing guard pattern to follow
- `src/common/decorators/public.decorator.ts` — @Public() decorator for skipping
- `src/app.module.ts` — APP_GUARD provider registration pattern
- `src/auth/auth.controller.ts` — add GET /auth/csrf-token endpoint
- Double-submit cookie pattern: CSRF token in non-httpOnly cookie + same value in custom header

**Acceptance Criteria**:
- [ ] `src/common/guards/csrf.guard.ts` created with double-submit cookie validation
- [ ] `GET /auth/csrf-token` returns `{ csrf_token }` + sets `csrf_token` cookie (non-httpOnly)
- [ ] POST/PUT/PATCH/DELETE requests to protected routes require matching `X-CSRF-Token` header
- [ ] Public routes (login, register, refresh) skip CSRF check
- [ ] `npm run build` succeeds
- [ ] All existing tests pass

**QA Scenarios**:
```
Scenario: GET CSRF token returns token + sets cookie
  Tool: Bash (curl -v)
  Preconditions: Server running
  Steps:
    1. curl -v GET /auth/csrf-token
    2. Check response body has "csrf_token" field
    3. Check Set-Cookie header includes "csrf_token=" WITHOUT HttpOnly flag
  Expected: Token in body + non-httpOnly cookie set
  Evidence: .sisyphus/evidence/cookie-auth-T5-csrf-get.log

Scenario: POST to protected route WITHOUT CSRF token → 403
  Tool: Bash (curl)
  Preconditions: Logged in, have auth_token cookie
  Steps:
    1. Login, capture auth_token cookie
    2. curl -X POST /products -b cookies.txt -H "Content-Type: application/json" -d '{}'
    3. Assert HTTP 403
  Expected: 403 Forbidden — CSRF token missing
  Evidence: .sisyphus/evidence/cookie-auth-T5-csrf-missing.log

Scenario: POST to protected route WITH CSRF token → succeeds
  Tool: Bash (curl)
  Preconditions: Logged in, have cookies
  Steps:
    1. Login, capture cookies
    2. curl GET /auth/csrf-token -b cookies.txt -c cookies.txt
    3. Extract csrf_token from cookie
    4. curl -X POST /products -b cookies.txt -H "X-CSRF-Token: TOKEN" ...
    5. Assert appropriate response (not 403)
  Expected: Request succeeds (not CSRF blocked)
  Evidence: .sisyphus/evidence/cookie-auth-T5-csrf-valid.log
```

**Commit**: YES (with T2+T3)
- Message: `feat(auth): add CSRF double-submit cookie protection`
- Files: `src/common/guards/csrf.guard.ts`, `src/auth/auth.controller.ts`, `src/app.module.ts`
- Pre-commit: `npm run build && npm run test`

---

### T2 — Update JWT strategy with cookie extraction fallback

**What to do**:
1. In `src/auth/strategies/jwt.strategy.ts`:
   - Import `Request` from `express`
   - Add a custom `jwtFromRequest` function that:
     a. First checks `req.cookies.auth_token`
     b. Falls back to `ExtractJwt.fromAuthHeaderAsBearerToken()`
   - For Express type: `import { Request } from 'express';`
   - The cookie extractor pattern: `(req: Request) => req.cookies?.auth_token ?? ExtractJwt.fromAuthHeaderAsBearerToken()(req)`

2. Update constructor `super()` config to use this combined extractor instead of `ExtractJwt.fromAuthHeaderAsBearerToken()` alone

**Must NOT do**:
- Don't change validation logic, payload interface, or user lookups
- Don't remove Bearer header support — it's a fallback

**Agent Profile**:
- Category: `quick`
- Skills: `[]`

**Parallelization**:
- Can Run In Parallel: YES
- Wave: 1 (with T1)
- Blocks: T3, T4
- Blocked By: T1

**References**:
- `src/auth/strategies/jwt.strategy.ts` — full file, current extractor at line 19
- Passport JWT docs: `jwtFromRequest` accepts custom function `(req) => token | null`
- Express type: `Request` from `'express'` — NestJS uses `@types/express`

**Acceptance Criteria**:
- [ ] JWT strategy extracts from `req.cookies.auth_token` first
- [ ] Falls back to `Authorization: Bearer` header
- [ ] `npm run build` succeeds
- [ ] All existing tests pass

**QA Scenarios**:
```
Scenario: Verify cookie extraction works
  Tool: Bash (curl)
  Preconditions: Server running, valid JWT token
  Steps:
    1. LOGIN first to get a token via curl
    2. Then call GET /dashboard/summary with --cookie "auth_token=TOKEN"
    3. Assert HTTP 200
  Expected: 200 OK (cookie-based auth works)
  Evidence: .sisyphus/evidence/cookie-auth-T2-cookie-success.log

Scenario: Verify Bearer fallback still works
  Tool: Bash (curl)
  Preconditions: Server running, valid JWT token
  Steps:
    1. Call GET /dashboard/summary with -H "Authorization: Bearer TOKEN" (no cookie)
    2. Assert HTTP 200
  Expected: 200 OK (header-based auth still works)
  Evidence: .sisyphus/evidence/cookie-auth-T2-bearer-fallback.log
```

**Commit**: YES (with T3)

---

### T3 — Update auth controller + service — set cookies, strip tokens from body

**What to do**:

**`auth.service.ts` changes:**
1. `login()` method:
   - Remove `access_token`, `refresh_token`, `expires_in` from return object
   - Return only `{ user: { id, username, role, tenantId } }`
   - Still internally generate tokens and save refresh token hash to DB

2. `register()` method:
   - Same pattern: remove tokens from return, return `{ message, user: {...} }`

3. `refreshAccessToken()` method:
   - Remove `refresh_token` parameter — no longer needs it passed in
   - Read from request context instead? No — better to move refresh logic to controller
   - Actually: keep service method as-is but update to accept `userId` directly (since controller reads cookie and passes userId)
   - OR: keep service receiving raw refreshToken string, pass userId too
   - **Decision**: Service stays mostly same but returns tokens object. Controller handles cookie setting.

4. Add a new method `generateTokensForUser(userId: string, username: string, role: string, tenantId: string)` that:
   - Creates access + refresh token pair
   - Saves refresh token hash to DB
   - Returns `{ accessToken, refreshToken, user: { id, username, role, tenantId } }`

**`auth.controller.ts` changes:**
1. Import `Response` from `express`: `import { Response } from 'express';`
2. Use `@Res({ passthrough: true }) res: Response` on login, register, refresh handlers
3. After service call succeeds, set cookies via `res.cookie()`:
   - `auth_token` cookie: value=accessToken, httpOnly=true, secure=(process.env.NODE_ENV==='production'), sameSite='lax', path='/', maxAge=15*60*1000
   - `refresh_token` cookie: value=refreshToken, httpOnly=true, secure=same, sameSite='lax', path='/', maxAge=7*24*60*60*1000
4. Set `sameSite: 'strict'` for refresh_token? No — `lax` is better (allows redirect-based flows)
5. Return only user data (no tokens) in response body

4. `refresh()` handler:
   - Read refresh_token from `req.cookies.refresh_token` instead of `@Headers('x-refresh-token')`
   - Import `@Req()` from NestJS: `import { Req } from '@nestjs/common';` and `import { Request } from 'express';`
   - Pass to service, get new tokens, set new cookies
   - Return `{ message: 'Token refreshed' }`

5. `logout()` handler:
   - Clear both cookies: `res.clearCookie('auth_token')`, `res.clearCookie('refresh_token')`
   - Keep revoking refresh tokens in DB

6. `register()` handler:
   - Same cookie-setting pattern as login

**Must NOT do**:
- Don't change the response interceptor or wrap pattern
- Don't break `@CurrentUser` decorator — it reads from `req.user` which passport sets
- Don't remove public decorators from login/register/refresh
- Don't change Throttle decorators
- Don't touch Swagger schema examples for existing DTOs

**Agent Profile**:
- Category: `quick`
- Skills: `[]`

**Parallelization**:
- Can Run In Parallel: YES
- Wave: 2 (with T4)
- Blocks: F1-F3
- Blocked By: T1, T2

**References**:
- `src/auth/auth.controller.ts` — all handlers
- `src/auth/auth.service.ts` — login, register, refresh, logout methods
- Express `Response.cookie()`: `res.cookie(name, value, { httpOnly, secure, sameSite, path, maxAge })`
- Express `Response.clearCookie()`: `res.clearCookie(name, options)`
- NestJS `@Res({ passthrough: true })` — allows both manual response control + NestJS interceptor handling

**Acceptance Criteria**:
- [ ] `POST /auth/login` returns `{ user: { id, username, role, tenantId } }` — NO tokens
- [ ] `POST /auth/login` sets `auth_token` + `refresh_token` cookies (check curl -v for Set-Cookie)
- [ ] `POST /auth/register` returns `{ message, user: {...} }` — NO tokens
- [ ] `POST /auth/register` sets both cookies
- [ ] `POST /auth/refresh` reads from cookie, sets new cookies
- [ ] `POST /auth/logout` clears both cookies
- [ ] `npm run build` succeeds
- [ ] All existing tests pass

**QA Scenarios**:
```
Scenario: Login returns user only, sets cookies
  Tool: Bash (curl -v)
  Preconditions: Server running
  Steps:
    1. curl -v -X POST /auth/login -H "Content-Type: application/json" -d '{"username":"admin1","password":"password123"}'
    2. Parse response body for presence of access_token field — assert NOT present
    3. Parse response body for presence of user field — assert PRESENT
    4. Check response headers for Set-Cookie containing "auth_token=" and "refresh_token="
    5. Check Set-Cookie includes HttpOnly flag
  Expected: Body = {"user":{...}} no tokens. Headers have 2 Set-Cookie headers with HttpOnly.
  Evidence: .sisyphus/evidence/cookie-auth-T3-login-cookie.log

Scenario: Authenticated request with cookie returns 200
  Tool: Bash (curl)
  Preconditions: Login first, capture cookies
  Steps:
    1. curl -c cookies.txt POST /auth/login ...
    2. curl -b cookies.txt GET /dashboard/summary
    3. Assert HTTP 200
  Expected: 200 OK
  Evidence: .sisyphus/evidence/cookie-auth-T3-authenticated-request.log

Scenario: Register sets cookies
  Tool: Bash (curl -v)
  Preconditions: Server running
  Steps:
    1. curl -v -X POST /auth/register -H "Content-Type: application/json" -d '...'
    2. Check response body: no tokens, only { message, user }
    3. Check Set-Cookie headers present
  Expected: Body has no tokens. Cookies set.
  Evidence: .sisyphus/evidence/cookie-auth-T3-register-cookie.log

Scenario: Logout clears cookies
  Tool: Bash (curl)
  Preconditions: Logged in with valid cookies
  Steps:
    1. Login, capture cookies
    2. curl -v -b cookies.txt -X POST /auth/logout
    3. Check Set-Cookie: auth_token=; Expires=... (past date)
    4. Check Set-Cookie: refresh_token=; Expires=... (past date)
  Expected: Both cookies cleared (expired)
  Evidence: .sisyphus/evidence/cookie-auth-T3-logout-clear.log
```

**Commit**: YES (with T2)
- Message: `feat(auth): migrate JWT to HttpOnly cookie-based auth`
- Files: `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/strategies/jwt.strategy.ts`
- Pre-commit: `npm run build && npm run test`

---

### T4 — Update FE useLoginMutation — remove manual cookie set

**What to do**:
1. In `src/features/auth/hooks/useLoginMutation.ts`:
   - Remove line: `document.cookie = ${AUTH_TOKEN_KEY}=${response.access_token}; ...`
   - Since backend now sets HttpOnly cookie, FE no longer needs manual cookie set
   - The response now returns `{ user }` instead of `{ access_token, user }`, so update destructuring

2. Update `LoginResponse` type in `src/features/auth/types/index.ts`:
   - Remove `access_token` field
   - Add or keep `user` field only

3. The `apiClient.ts` already reads cookie and sends as Bearer header — no changes needed there

4. Update `useRegisterMutation.ts` if exists (same pattern)

**Must NOT do**:
- Don't change middleware.ts (still reads cookie correctly)
- Don't change apiClient.ts (still works)

**Agent Profile**:
- Category: `quick`
- Skills: `[]`

**Parallelization**:
- Can Run In Parallel: YES
- Wave: 2 (with T3)
- Blocks: F3
- Blocked By: T2

**References**:
- `src/features/auth/hooks/useLoginMutation.ts` — full file
- `src/features/auth/types/index.ts` — LoginResponse type
- `src/features/auth/hooks/useRegisterMutation.ts` — if exists

**Acceptance Criteria**:
- [ ] `useLoginMutation.ts` no longer sets `document.cookie`
- [ ] LoginResponse type updated (no access_token)
- [ ] FE login flow works end-to-end (backend sets cookie, FE reads it)
- [ ] `npm run build` succeeds on FE

**QA Scenarios**:
```
Scenario: Verify FE build succeeds
  Tool: Bash
  Preconditions: FE directory
  Steps:
    1. cd crack-fe/crack-fe-yogaaaa123 && npm run build
    2. Check exit code === 0
  Expected: Build succeeds
  Evidence: .sisyphus/evidence/cookie-auth-T4-fe-build.log
```

**Commit**: YES
- Message: `fix(fe): remove manual cookie set — backend now sets HttpOnly cookie`
- Files: `src/features/auth/hooks/useLoginMutation.ts`, `src/features/auth/types/index.ts`
- Pre-commit: `npm run build`

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify: cookie-parser installed, JWT strategy has cookie fallback, controller sets cookies, service returns no tokens, FE login hook updated. Check all must-haves, verify no must-not-haves present.

- [ ] F2. **Code Quality Check** — `unspecified-high`
  `npm run build` on both BE + FE. `npm run test` on BE. Review diffs for: console.log, as any, unused imports, commented code.

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start server from scratch. Execute ALL QA scenarios from all tasks. Test full flow: register → auto-login → protected route → refresh → logout → protected route blocked.

---

## Commit Strategy

| Task | Message | Files | Pre-commit |
|------|---------|-------|------------|
| T1 | `chore(deps): add cookie-parser for HttpOnly cookie auth` | package.json, package-lock.json, src/main.ts | `npm run build` |
| T2+T3 | `feat(auth): migrate JWT to HttpOnly cookie-based auth` | auth.controller.ts, auth.service.ts, jwt.strategy.ts | `npm run build && npm run test` |
| T4 | `fix(fe): remove manual cookie set — backend now sets HttpOnly cookie` | useLoginMutation.ts, types/index.ts | `npm run build` |

---

## Success Criteria

### Verification Commands
```bash
# Backend build + test
npm run build && npm run test

# FE build
cd ../crack-fe/crack-fe-yogaaaa123 && npm run build

# Full curl test
curl -v -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"password123"}' \
  2>&1 | grep -E "Set-Cookie:|^{"
```

### Final Checklist
- [ ] All "Must Have" present — cookies set, no tokens in body, JWT strategy accepts cookie
- [ ] All "Must NOT Have" absent — no token in response body
- [ ] All tests pass — BE `npm run test`
- [ ] FE builds successfully
