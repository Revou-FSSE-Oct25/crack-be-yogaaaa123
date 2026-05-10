---
session: ses_20b6
updated: 2026-05-05T06:49:17.217Z
---

# Session Summary

## Goal

Migrate backend auth from Bearer header-based JWT to HttpOnly cookie-based auth with CSRF double-submit cookie protection, and update the Next.js FE proxy to forward backend cookies properly.

## Constraints & Preferences

- Backend: NestJS v11 on `crack-be/crack-be-yogaaaa123`, Prisma v7, PostgreSQL
- Frontend FE: `test-fe-be/` — Next.js with Route Handler proxy pattern (all requests go through `/api/proxy/[...path]/route.ts`)
- BE CORS origins: `http://localhost:5173` and `http://localhost:3001`
- JWT strategy must decode from cookie first (`auth_token`), fallback to Bearer header
- CSRF: non-httpOnly `csrf_token` cookie + `X-CSRF-Token` header on unsafe methods (POST/PATCH/PUT/DELETE)
- CsrfGuard skips `@Public()` routes and GET/HEAD/OPTIONS
- Token rotation on refresh: old refresh token revoked, new one issued
- Auth service returns `{ accessToken, refreshToken, user }` (camelCase) — controller maps to cookies
- Brute force protection: 5 failed attempts → 30 minute lock
- Rate limits: auth 10/min, refresh 5/min, register 5/min, global 60/min

## Progress

### Done

- [x] **BE cookie-parser + CORS**: installed `cookie-parser` + `@types/cookie-parser`, registered in `main.ts` before CORS, CORS allowedHeaders added `x-csrf-token`
- [x] **BE JWT strategy dual-mode**: `jwt.strategy.ts` reads `req.cookies.auth_token` first, falls back to `ExtractJwt.fromAuthHeaderAsBearerToken()`
- [x] **BE auth controller + service**: login/register/refresh/logout now use `@Res({ passthrough: true })` + `res.cookie()` to set HttpOnly cookies (`auth_token` 15m, `refresh_token` 7d), body response stripped of tokens: login returns `{ user }`, register returns `{ message, user }`, refresh returns `{ message }`, logout clears cookies
- [x] **BE CSRF guard**: `csrf.guard.ts` validates double-submit cookie (skips `@Public()` routes, GET/HEAD/OPTIONS), registered as global `APP_GUARD`; `GET /auth/csrf-token` endpoint generates `csrf_token` cookie
- [x] **FE login route**: `login/route.ts` rewritten — no longer parses `access_token` from body; forwards `Set-Cookie` header from BE directly to browser
- [x] **FE api.ts CSRF interceptor**: added `UNSAFE_METHODS` check + request interceptor that reads `csrf_token` cookie and sets `X-CSRF-Token` header on POST/PATCH/PUT/DELETE; added warning log on 403 status
- [x] **FE AuthContext refactored**: removed localStorage token/user storage; uses `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` via fetch; login does `window.location.href = '/dashboard'` for full page reload to pick up cookies
- [x] **BE build + tests**: `npm run build` OK, `npm run test` — 97/97 PASS
- [x] **FE build**: `npx next build` OK
- [x] **Both projects committed and pushed**
- [x] **README.md rewritten**: comprehensive architecture docs with ASCII diagram, endpoint tables, security features, error handling, database schema

### In Progress

- (none)

### Blocked

- (none)

## Key Decisions

- **Cookie-forward instead of manual token parsing in FE proxy**: BE sets HttpOnly cookies, FE `login/route.ts` reads `Set-Cookie` from BE response and forwards those headers to the browser — avoids duplicate cookie management
- **Use `any` type for `@Res()`/`@Req()` parameters**: `isolatedModules` + `emitDecoratorMetadata` prevents `import type { Response }` for decorated params; runtime injection works regardless
- **camelCase in service return vs snake_case in DB**: Service returns `accessToken`/`refreshToken`, controller maps to cookies — cleaner code in controller layer

## Next Steps

1. ~~Complete FE build tests~~ (done)
2. ~~Push changes to remote~~ (done)
3. ~~Update README.md with architecture docs~~ (done)

## Critical Context

- BE repo: `crack-be/crack-be-yogaaaa123.git` on branch `backend-tester`, remote `origin`
- FE repo: `Frontend-crack-2026.git` on branch `main`
- Deployed BE URL: probably Railway (`https://proud-achievement-production-c636.up.railway.app`) — verify if deployment needs env var updates for cookie auth
- BE `main.ts` has environment validation — will `exit(1)` if `JWT_SECRET`, `DATABASE_URL`, or `AI_INTERNAL_API_KEY` are missing or weak defaults
- Uploaded images stored to `./uploads/` but NOT served via static middleware — FE cannot access uploaded files. Needs `@nestjs/serve-static` or external storage (S3/Cloudinary) to work properly

## File Operations

### Read

- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/.env.example`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/README.md`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/package.json`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/prisma/schema.prisma`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/src/app.module.ts`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/src/auth/auth.controller.ts`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/src/auth/auth.service.ts`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/src/main.ts`
- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/src/upload/upload.controller.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/app/api/auth/login/route.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/app/api/auth/logout/route.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/app/api/auth/me/route.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/app/api/proxy/[...path]/route.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/lib/api.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/lib/services.ts`
- `/home/satria/Final-project-crack/test-fe-be/src/proxy.ts`

### Written

- `/home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123/README.md` (rewritten with full architecture docs)
- `/home/satria/Final-project-crack/test-fe-be/src/app/api/auth/login/route.ts` (rewritten to forward Set-Cookie)
- `/home/satria/Final-project-crack/test-fe-be/src/lib/api.ts` (added CSRF interceptor)
