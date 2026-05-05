---
session: ses_20b6
updated: 2026-05-04T21:53:31.653Z
---

# Session Summary

## Goal
Migrate backend auth from `Authorization: Bearer` header-based JWT to HttpOnly cookie-based auth (access + refresh tokens), plus add CSRF protection via double-submit cookie pattern.

## Constraints & Preferences
- Backend: NestJS 11, Passport JWT strategy, Prisma v7, PostgreSQL
- Frontend: Next.js, reads token from `auth_token` cookie key
- FE `middleware.ts`, `apiClient.ts` already read cookie — must not break
- All tokens removed from response body (login, register, refresh)
- CSRF: double-submit cookie pattern (non-httpOnly `csrf_token` cookie + `X-CSRF-Token` header)
- CSRF guard skips `@Public()` routes (login, register, refresh, health, csrf-token)
- JWT strategy must keep Bearer header fallback (dual-mode)
- CORS already has `credentials: true`; added `x-csrf-token` to allowedHeaders
- Existing guards, decorators, response interceptor unchanged
- No Prisma schema/DB migration changes
- `isolatedModules` + `emitDecoratorMetadata` enabled — `import type` cannot be used for types referenced in decorated parameters (use `any` instead of `Response` type on `@Res()` parameters)

## Progress
### Done
- [x] **T1**: Installed `cookie-parser` + `@types/cookie-parser`, registered in `main.ts` (before CORS, after helmet), CORS allowedHeaders updated with `x-csrf-token`
- [x] **T2**: Updated `jwt.strategy.ts` — cookie extraction from `req.cookies.auth_token` first, falls back to `ExtractJwt.fromAuthHeaderAsBearerToken()`
- [x] **T5** (partial): Created `csrf.guard.ts` with double-submit cookie validation (skips `@Public()` routes, GET/HEAD/OPTIONS), registered as global `APP_GUARD` in `app.module.ts`
- [x] **T5** (partial): Added `GET /auth/csrf-token` endpoint — returns `{ csrf_token }` + sets non-httpOnly `csrf_token` cookie
- [x] **T3** (partial): Updated `auth.service.ts` — login/register/refresh return `{ accessToken, refreshToken, user }` instead of `{ access_token, refresh_token, expires_in, user }`; register returns `{ message, accessToken, refreshToken, user }`
- [x] **T3** (partial): Updated `auth.controller.ts` — login/register/refresh use `@Res({ passthrough: true })` to set HttpOnly cookies (`auth_token` 15m, `refresh_token` 7d); refresh reads from `req.cookies.refresh_token` instead of `x-refresh-token` header; logout clears both cookies; added `getCookieOptions()` helper

### In Progress
- [ ] Build fix — `Request` type used in `@Req()` and `Response` in `@Res()` cause `isolatedModules` TS errors; switched to `any` for `res` and `req` parameters (runtime still works)

### Blocked
- (none — fixing build errors now)

## Key Decisions
- **`any` type for `@Res()` / `@Req()` parameters**: `isolatedModules` + `emitDecoratorMetadata` prevents `import type { Response }` for decorated params; runtime injection works regardless of TS types
- **camelCase token keys in service return**: Changed from `access_token`/`refresh_token` to `accessToken`/`refreshToken` for cleaner controller usage; controller maps these to cookies
- **Cookie options extracted to private `getCookieOptions()`**: Avoids repetition across login/register/refresh; same base options (httpOnly=true, sameSite=lax, path=/)

## Next Steps
1. Fix remaining build errors (accessToken var name mismatch in service already fixed, Request type issue fixed)
2. Run `npm run build && npm run test` to verify Wave 1+2 (T1+T2+T5+T3)
3. Execute **T4**: Update FE `useLoginMutation.ts` — remove `document.cookie` line, update `LoginResponse` type
4. Execute **T6**: Update FE `apiClient.ts` — add `X-CSRF-Token` header from `csrf_token` cookie on unsafe methods
5. **FINAL**: Run both BE and FE builds, tests, and QA

## Critical Context
- Plan file: `.sisyphus/plans/cookie-auth-migration.md` (already reviewed)
- BE `AUTH_TOKEN_KEY` cookie name = `'auth_token'` — matches FE's `AUTH_TOKEN_KEY` in `constants.ts`
- FE `apiClient.ts` already reads `auth_token` from cookie and sends as Bearer header — no change needed for auth, but needs CSRF header addition
- FE `useLoginMutation.ts` line 22: `document.cookie = \`${AUTH_TOKEN_KEY}=${response.access_token};...\`` — must be removed
- FE `LoginResponse` type: currently `{ access_token, user }` — must be updated to `{ user }` only
- FE `useRegisterMutation.ts` calls `apiClient('/users', ...)` — this is a different endpoint, not `/auth/register`. The register return type is not typed, just uses generic T
- FE `client.ts` already has `UNSAFE_METHODS` constant — T6 needs to read `csrf_token` cookie and set `X-CSRF-Token` header
