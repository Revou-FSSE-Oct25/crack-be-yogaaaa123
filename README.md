# CrackPOS Backend — Inventory Management API

Enterprise-grade inventory management backend built with **NestJS v11**, **Prisma v7**, and **PostgreSQL**.  
Multi-tenant SaaS architecture with role-based access control, real-time stock tracking, and AI-powered insights.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Authentication & Security](#-authentication--security)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)
- [Environment Variables](#-environment-variables)
- [Error Handling](#-error-handling)
- [Scripts](#-scripts)
- [Docker](#-docker)

---

## 🧩 Tech Stack

| Layer            | Tech                                                              |
| ---------------- | ----------------------------------------------------------------- |
| **Framework**    | NestJS v11 (Express under the hood)                               |
| **Language**     | TypeScript 5+ with `strict` mode                                  |
| **Database**     | PostgreSQL 15+                                                     |
| **ORM**          | Prisma v7 (type-safe database client)                             |
| **Auth**         | JWT (Passport) + HttpOnly Cookie + bcrypt (cost factor 12)        |
| **CSRF**         | Double-submit cookie pattern                                      |
| **Validation**   | `class-validator` + `class-transformer`                           |
| **API Docs**     | Swagger / OpenAPI (auto-generated at `/api`)                      |
| **Rate Limit**   | `@nestjs/throttler` — multi-tenant aware                          |
| **Logging**      | Winston (structured JSON in production, colorful in dev)          |
| **File Upload**  | Multer (max 5MB, jpeg/png/gif/webp only)                          |
| **Caching**      | In-memory with 30s TTL for GET endpoints                          |
| **AI**           | Python microservice integration (separate service)                |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Auth UI  │  │ Dashboard│  │   apiClient (axios)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │             │                    │              │
│       └─────────────┼────────────────────┘              │
│                     │  HttpOnly Cookie (auth_token)      │
│                     │  + X-CSRF-Token header            │
└─────────────────────┼───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              CrackPOS Backend (NestJS)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Global Guards (layer)                │   │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────┐     │   │
│  │  │JwtAuth   │  │TenantThrott│  │CsrfGuard │     │   │
│  │  │Guard     │  │lerGuard   │  │(CSRF)    │     │   │
│  │  └────┬─────┘  └────────────┘  └────┬─────┘     │   │
│  └───────┼──────────────────────────────┼───────────┘   │
│          │                              │               │
│          ▼                              ▼               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Feature Modules                      │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │  │Auth  │ │Users │ │Product│ │Sales │ │Purchase│  │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │  │Invtry│ │Return│ │Report│ │Dashbd│ │Upload │  │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │         PrismaService (Database Layer)            │   │
│  │  - Tenant isolation via getClient(tenantId)       │   │
│  │  - Auto soft-delete filtering                     │   │
│  │  - Transaction support                            │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼                              │
│              ┌─────────────────────┐                    │
│              │     PostgreSQL      │                    │
│              │  (Multi-tenant DB)  │                    │
│              └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Python AI Service  │
              │  (crack-ai)         │
              └─────────────────────┘
```

### Key Architecture Decisions

**Multi-tenant via Row-Level Isolation**  
Every table has a `tenantId` column. The `PrismaService.getClient(tenantId)` returns an extended Prisma client that automatically adds `WHERE tenantId = ?` to every query. No separate databases per tenant — cheaper and simpler to manage.

**Cookie-Based Auth with CSRF Protection**  
JWT tokens are stored in **HttpOnly cookies** (`auth_token`, `refresh_token`), not in `localStorage`. This prevents XSS-based token theft. CSRF is handled via **double-submit cookie pattern** — a non-httpOnly `csrf_token` cookie + `X-CSRF-Token` header on unsafe methods (POST, PATCH, PUT, DELETE).

**Global Guards Pipeline**  
All requests pass through three global guards in order:
1. **JwtAuthGuard** — extracts JWT from cookie (primary) or Bearer header (fallback)
2. **TenantThrottlerGuard** — rate limits per tenant (not per IP, preventing noisy-neighbor issues)
3. **CsrfGuard** — validates CSRF token on state-changing requests (skips `@Public()` routes)

**Audit Logging**  
Every mutation (CREATE, UPDATE, DELETE) is automatically logged via `AuditLogInterceptor` — who did what, when, and on which entity.

---

## 🚀 Quick Start

```bash
# 1. Clone & install dependencies
npm install

# 2. Copy environment file and fill in your values
cp .env.example .env
# Edit .env with your database URL, JWT secret, etc.

# 3. Run database migration
npx prisma migrate dev

# 4. Seed default admin & staff users
npx prisma db seed

# 5. Start development server (hot reload)
npm run start:dev
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/api`.

### Default Seed Users

| Username  | Password       | Role  |
| --------- | -------------- | ----- |
| `admin1`  | `password123`  | ADMIN |
| `staff1`  | `password123`  | STAFF |

---

## 📁 Project Structure

```
src/
├── app.module.ts                 # Root module — registers global guards & interceptors
├── main.ts                       # Bootstrap — CORS, Helmet, CookieParser, Swagger, Validation
├── prisma.service.ts             # Prisma client with tenant isolation extension
├── prisma.module.ts              # Shared Prisma module
├── logger.config.ts              # Winston logger configuration
│
├── auth/                         # 🔐 Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts        # POST /auth/login, /auth/register, /auth/refresh, /auth/logout
│   ├── auth.service.ts           # Login logic, brute force protection, token rotation
│   ├── dto/login.dto.ts
│   ├── dto/register.dto.ts
│   └── strategies/
│       └── jwt.strategy.ts       # Dual-mode: cookie first, Bearer header fallback
│
├── users/                        # 👥 User management (Admin only)
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── users.service.ts
│
├── categories/                   # 🏷️ Product categories
├── suppliers/                    # 🤝 Supplier management
├── products/                     # 📦 Product catalog (search, pagination, filter)
├── inventory/                    # 📊 Stock transactions & adjustments
├── sales/                        # 🛒 Sales orders with COGS tracking
├── purchase/                     # 🚚 Purchase orders from suppliers
├── returns/                      # ↩️ Sales returns with stock reversal
├── activity-log/                 # 📋 Audit trail
├── dashboard/                    # 📈 Dashboard analytics (summary, top products, trends)
├── reports/                      # 📑 Reports (Admin only)
├── upload/                       # 📤 File upload (product images via Multer)
├── health/                       # ❤️ Health check endpoint
├── ai/                           # 🤖 AI chat integration module
├── ai-data/                      # 🔌 AI data API (read-only endpoints for Python AI service)
├── admin/                        # 🛡️ Platform admin module
│
└── common/                       # 🔧 Shared utilities
    ├── decorators/
    │   ├── current-user.decorator.ts   # @CurrentUser() parameter decorator
    │   ├── public.decorator.ts         # @Public() — skip JWT auth
    │   └── roles.decorator.ts          # @Roles() — role-based access
    ├── guards/
    │   ├── jwt-auth.guard.ts           # Global JWT guard (reads cookie first)
    │   ├── csrf.guard.ts               # Double-submit cookie CSRF validation
    │   ├── roles.guard.ts              # Role-based authorization
    │   └── tenant-throttler.guard.ts   # Tenant-aware rate limiting
    ├── filters/
    │   ├── http-exception.filter.ts
    │   ├── prisma-client-exception.filter.ts
    │   └── all-exceptions.filter.ts
    └── interceptors/
        ├── response.interceptor.ts     # Standardized JSON envelope
        ├── cache.interceptor.ts        # 30s in-memory cache for GET
        └── audit-log.interceptor.ts    # Auto-log all mutations
```

---

## 🔐 Authentication & Security

### How Auth Works

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Browser │                    │  NestJS  │                    │    DB    │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                              │
     │  POST /auth/login             │                              │
     │  { username, password }       │                              │
     │──────────────────────────────>│                              │
     │                               │  Verify credentials         │
     │                               │─────────────────────────────>│
     │                               │<─────────────────────────────│
     │                               │                              │
     │  200 OK                       │                              │
     │  Set-Cookie: auth_token=...   │                              │
     │  Set-Cookie: refresh_token=.. │                              │
     │  { user: {...} }              │                              │
     │<──────────────────────────────│                              │
     │                               │                              │
     │  GET /products (cookie auto)  │                              │
     │  Cookie: auth_token=...       │                              │
     │──────────────────────────────>│                              │
     │                               │  Validate JWT from cookie    │
     │                               │  (fallback: Bearer header)   │
     │                               │  Check tenant rate limit     │
     │                               │  (skip CSRF for GET)        │
     │                               │                              │
     │  200 OK { data: [...], total }│                              │
     │<──────────────────────────────│                              │
     │                               │                              │
     │  POST /sales (unsafe method)  │                              │
     │  Cookie: auth_token=...       │                              │
     │  X-CSRF-Token: abc123...      │                              │
     │──────────────────────────────>│                              │
     │                               │  Validate JWT + CSRF token  │
     │                               │  Log audit trail             │
     │                               │                              │
     │  201 Created                  │                              │
     │<──────────────────────────────│                              │
```

### Security Features

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with cost factor 12 |
| **JWT Storage** | HttpOnly cookie (not accessible via JavaScript) |
| **Token Refresh** | Rotation — old token revoked on each refresh |
| **CSRF Protection** | Double-submit cookie pattern |
| **Brute Force Protection** | Account locked after 5 failed attempts (30 min) |
| **Rate Limiting** | 10 req/min for auth, 60 req/min general (per tenant) |
| **Input Validation** | `class-validator` whitelist + forbidNonWhitelisted |
| **SQL Injection** | Prevented by Prisma's parameterized queries |
| **XSS** | Helmet security headers + HttpOnly cookies |
| **Soft Delete** | No data is permanently deleted (`deletedAt` timestamp) |

---

## 🔌 API Endpoints

### 🔐 Authentication (Public)

| Method | Path | Rate Limit | Description |
|--------|------|------------|-------------|
| POST | `/auth/login` | 10/min | Login — sets HttpOnly cookies, returns `{ user }` |
| POST | `/auth/register` | 5/min | Register new store — auto-creates tenant + admin user |
| POST | `/auth/refresh` | 5/min | Refresh access token (reads `refresh_token` cookie) |
| GET | `/auth/csrf-token` | — | Get CSRF token (sets non-httpOnly `csrf_token` cookie) |
| GET | `/health` | — | Health check (DB connection, uptime) |

### 👥 Users (Admin Only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create user |
| GET | `/users` | List all users (paginated: `?skip=&take=`) |
| GET | `/users/:id` | Get user by ID |
| PATCH | `/users/:id` | Update user role |
| DELETE | `/users/:id` | Soft delete user |
| PATCH | `/users/:id/change-password` | Change own password (JWT) |

### 🏷️ Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/categories` | Admin | Create category |
| GET | `/categories` | JWT | List all (paginated) |
| GET | `/categories/:id` | JWT | Get by ID |
| PATCH | `/categories/:id` | Admin | Update category |
| DELETE | `/categories/:id` | Admin | Soft delete category |

### 📦 Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/products` | Admin | Create product |
| GET | `/products` | JWT | List all (`?search=&categoryId=&supplierId=&skip=&take=`) |
| GET | `/products/:id` | JWT | Get by ID |
| PATCH | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Soft delete product |

### 📊 Inventory / Stock

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/inventory` | JWT | List stock transactions (paginated) |
| GET | `/inventory/stock` | JWT | Get current stock for all products |
| POST | `/inventory/adjust` | Admin/Staff | Adjust stock (IN/OUT/ADJUSTMENT) |

### 🛒 Sales Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/sales` | Admin/Staff | Create sales order (auto stock deduction) |
| POST | `/sales/pending` | Admin/Staff | Create pending order |
| GET | `/sales` | JWT | List sales orders (paginated) |
| GET | `/sales/:id` | JWT | Get by ID |
| PATCH | `/sales/:id/complete` | Admin/Staff | Complete order |
| PATCH | `/sales/:id/cancel` | Admin/Staff | Cancel order (auto stock reversal) |

### 🚚 Purchase Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/purchase` | Admin/Staff | Create purchase order |
| POST | `/purchase/pending` | Admin/Staff | Create pending purchase |
| GET | `/purchase` | JWT | List purchase orders (paginated) |
| GET | `/purchase/:id` | JWT | Get by ID |
| PATCH | `/purchase/:id/receive` | Admin/Staff | Receive order (auto stock IN) |
| PATCH | `/purchase/:id/cancel` | Admin/Staff | Cancel purchase order |
| GET | `/purchase/supplier-summary/:id` | JWT | Purchase summary by supplier |

### ↩️ Sales Returns

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/returns` | Admin/Staff | Create return (auto stock reversal + financial correction) |
| GET | `/returns` | JWT | List returns (paginated) |
| GET | `/returns/:id` | JWT | Get by ID |

### 📈 Dashboard (JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` | Counts, revenue, low stock alerts |
| GET | `/dashboard/top-products` | Top selling products |
| GET | `/dashboard/sales-trend` | Sales trend over last N days |
| GET | `/dashboard/inventory-value` | Total stock value |

### 📑 Reports (Admin Only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/sales` | Sales report (filter by date range) |
| GET | `/reports/inventory` | Full inventory report |
| GET | `/reports/profit-loss` | Profit & loss report |

### 📤 Upload (Admin Only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload/image` | Upload product image (max 5MB, jpeg/png/gif/webp) |

### 🤖 AI Chat (JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/chat` | Send message to AI assistant |
| GET | `/ai/chat/history` | Get chat history |
| DELETE | `/ai/chat/history` | Clear chat history |

### 📖 API Documentation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | Swagger UI (interactive API docs) |

---

## 🗃️ Database Schema

```
Tenant ──┬── TenantUser ──── RefreshToken
         ├── PlatformMember ── PlatformUser
         ├── Product ──────── Category, Supplier
         ├── StockTransaction
         ├── SalesOrder ───── OrderItem ──── SalesReturn ── SalesReturnItem
         ├── PurchaseOrder ── PurchaseOrderItem
         └── ActivityLog
```

### Entity Relationships

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Tenant** | Toko (store) — root of multi-tenant isolation | `name`, `slug`, `aiApiKey` |
| **PlatformUser** | User global (email/password login) | `email`, `googleId` |
| **TenantMember** | Relasi PlatformUser → Tenant | `role` (OWNER/MEMBER) |
| **TenantUser** | User dalam toko (login ke POS) | `username`, `role` (ADMIN/STAFF) |
| **Product** | Produk dengan SKU & harga | `sku`, `name`, `price`, `stockQuantity` |
| **Category** | Kategori produk | `name` |
| **Supplier** | Pemasok | `name`, `phone`, `email` |
| **StockTransaction** | Riwayat stok (ledger) | `type` (IN/OUT/ADJUSTMENT/RETURN) |
| **SalesOrder** | Pesanan penjualan | `status`, `totalPrice`, `totalProfit` |
| **PurchaseOrder** | Pesanan pembelian | `status`, `totalPrice` |
| **SalesReturn** | Retur penjualan | `status`, `totalRefund` |
| **ActivityLog** | Catatan audit | `action`, `entity`, `metadata` (JSON) |
| **RefreshToken** | Token refresh JWT | `token` (hashed), `expiresAt`, `revokedAt` |

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | JWT signing secret (min 64 chars, use `openssl rand -hex 64`) |
| `PORT` | ❌ | `3000` | Server port |
| `ALLOWED_ORIGINS` | ❌ | `http://localhost:5173,http://localhost:3001` | CORS allowed origins |
| `DEFAULT_ADMIN_PASSWORD` | ❌ | — | Seed admin password |
| `DEFAULT_STAFF_PASSWORD` | ❌ | — | Seed staff password |
| `UPLOAD_DIR` | ❌ | `./uploads` | Upload directory for product images |
| `AI_SERVICE_URL` | ❌ | `http://localhost:8001` | Python AI service URL |
| `AI_INTERNAL_API_KEY` | ✅ | — | Internal API key for BE↔AI communication |

---

## ⚠️ Error Handling

All errors follow a consistent JSON format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["username must be a string", "password must be longer than 8 characters"],
  "timestamp": "2026-05-05T12:00:00.000Z"
}
```

### HTTP Status Codes Used

| Code | Description |
|------|-------------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Validation error / Bad request |
| 401 | Unauthorized (missing/invalid JWT) |
| 403 | Forbidden (wrong role) or CSRF validation failed |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, username, etc.) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Backend service unavailable |

### Response Envelope (Success)

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-05-05T12:00:00.000Z"
}
```

For paginated endpoints, `data` contains:
```json
{
  "data": [ ... ],
  "total": 42,
  "skip": 0,
  "take": 10
}
```

---

## ⚡ Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in watch mode with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production server |
| `npm run lint` | Lint all files (Prettier) |
| `npm run test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run end-to-end tests |
| `npx prisma migrate dev` | Run database migrations |
| `npx prisma db seed` | Seed default users |
| `npx prisma studio` | Open Prisma Studio (DB browser) |

---

## 🐳 Docker

```bash
# Build image
docker build -t crackpos-backend .

# Run with PostgreSQL
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  -e AI_INTERNAL_API_KEY="your-key" \
  crackpos-backend
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run e2e tests
npm run test:e2e
```

Current test coverage: **97 tests across 8 suites** — covering auth flow, guards, services, and controllers.
