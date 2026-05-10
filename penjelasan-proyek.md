# Penjelasan Proyek - CrackPOS Backend

> **CrackPOS** adalah sistem manajemen inventaris dan Point of Sale berbasis web. Backend ini dibangun dengan NestJS, Prisma, dan PostgreSQL. Mendukung multi-tenant (banyak toko), integrasi AI, dan keamanan tingkat tinggi.

---

## Daftar Isi
1. [Tech Stack](#-tech-stack)
2. [Struktur Folder](#-struktur-folder)
3. [Penjelasan Per File](#-penjelasan-per-file)
4. [Alur Autentikasi](#-alur-autentikasi)
5. [Fitur Keamanan](#-fitur-keamanan)
6. [API Endpoints](#-api-endpoints)
7. [Cara Jalanin](#-cara-jalanin)

---

## 🧩 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | NestJS 11 |
| Bahasa | TypeScript (strict mode) |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Auth | JWT + HttpOnly Cookie + bcrypt |
| AI | Python FastAPI (terpisah, di folder crack-ai/) |
| API Docs | Swagger (otomatis di /api) |

---

## 📁 Struktur Folder

```
src/
├── main.ts                          # Entry point aplikasi
├── app.module.ts                    # Module utama (gabungin semua module)
├── prisma.service.ts                # Koneksi database + tenant isolation
├── prisma.extension.ts              # Extension Prisma untuk soft delete + tenant filter
│
├── auth/                            # 🔐 Autentikasi
│   ├── auth.controller.ts           #   Endpoint login/register/google/logout
│   ├── auth.service.ts              #   Logic auth + Google OAuth + create store
│   ├── auth.module.ts               #   Module registration
│   ├── dto/                         #   Data Transfer Objects
│   │   ├── login.dto.ts             #     { username, password }
│   │   ├── register.dto.ts          #     { storeName, username, email, password }
│   │   ├── google-login.dto.ts      #     { idToken } (BARU)
│   │   └── create-store.dto.ts      #     { storeName, username, password } (BARU)
│   └── strategies/
│       └── jwt.strategy.ts          #   Baca JWT dari cookie atau Bearer header
│
├── users/                           # 👥 Management User (Admin toko)
│   ├── users.controller.ts          #   CRUD user untuk satu toko
│   └── users.service.ts
│
├── products/                        # 📦 Produk
│   ├── products.controller.ts       #   CRUD produk + search + filter
│   ├── products.service.ts          #   Logic produk, pagination
│   └── dto/                         #   create-product.dto, update-product.dto
│
├── categories/                      # 🏷️ Kategori
│   ├── categories.controller.ts     #   CRUD kategori
│   └── categories.service.ts
│
├── suppliers/                       # 🤝 Supplier/Pemasok
│   ├── suppliers.controller.ts      #   CRUD supplier
│   └── suppliers.service.ts
│
├── sales/                           # 🛒 Penjualan
│   ├── sales.controller.ts          #   Buat transaksi, list, complete, cancel
│   ├── sales.service.ts             #   Logic penjualan + stok + COGS
│   └── dto/                         #   create-sales-order.dto
│
├── inventory/                       # 📊 Inventaris
│   ├── inventory.controller.ts      #   Adjust stok, low stock, AI input
│   ├── inventory.service.ts         #   Logic stok + aiProductInput (BARU)
│   └── dto/                         #   adjust-stock.dto, ai-product-input.dto (BARU)
│
├── dashboard/                       # 📈 Dashboard
│   ├── dashboard.controller.ts      #   Summary, top products, trend, nilai inventaris
│   └── dashboard.service.ts
│
├── admin/                           # 🛡️ Super Admin (developer/pemilik platform)
│   ├── admin.controller.ts          #   Login super admin, list tenant, statistik
│   └── admin.service.ts             #   Query semua tenant + agregasi
│
├── ai/                              # 🤖 Integrasi AI Chat
│   ├── ai.controller.ts             #   Proxy chat ke Python AI service
│   ├── ai.service.ts                #   Forward request/response
│   └── dto/
│       └── ai-chat-request.dto.ts
│
├── common/                          # 🔧 Utility bersama
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        #     Guard JWT global (semua route butuh auth)
│   │   ├── platform-jwt.guard.ts    #     Guard khusus token dari Google login (BARU)
│   │   ├── csrf.guard.ts            #     Proteksi CSRF double-submit cookie
│   │   ├── roles.guard.ts           #     RBAC (Admin/Staff)
│   │   └── tenant-throttler.guard.ts#     Rate limit per tenant
│   ├── filters/
│   │   ├── http-exception.filter.ts #     Filter error HTTP (prod: tanpa stack trace)
│   │   ├── all-exceptions.filter.ts #     Filter error fallback
│   │   └── prisma-client-exception.filter.ts # Error Prisma
│   ├── interceptors/
│   │   ├── response.interceptor.ts  #     Bungkus response: { statusCode, message, data, timestamp }
│   │   └── audit-log.interceptor.ts #     Catat semua perubahan data
│   ├── middleware/
│   │   └── sanitize.middleware.ts   #     Bersihin input dari tag HTML (BARU)
│   └── decorators/
│       ├── current-user.decorator.ts #     @CurrentUser() — ambil data user dari JWT
│       ├── roles.decorator.ts        #     @Roles() — batasi akses per role
│       └── public.decorator.ts       #     @Public() — endpoint tanpa JWT
│
├── health/                          # ❤️ Health Check
└── upload/                          # 📤 Upload Gambar
```

### Folder Tambahan (Root)
```
crack-ai/                            # Python AI Service (FastAPI)
├── main.py                          #   Entry point: /chat, /health, /ai/product-from-image
├── ai_service.py                    #   Logic LLM + output guard anti prompt injection
├── auth.py                          #   Verifikasi JWT + isolasi tenant
├── config.py                        #   Config dari env
├── database.py                      #   Koneksi DB + tabel audit log AI
├── schemas.py                       #   Pydantic models
├── tools/                           #   Fungsi read-only untuk AI (dashboard, produk, dll)
└── Dockerfile                       #   Docker image

prisma/
└── schema.prisma                    # Schema database (semua tabel + relasi)

docker-compose.yml                   # 3 service: db + backend + ai
```

---

## 📄 Penjelasan Per File Penting

### `src/main.ts`
Entry point. Urutan eksekusi:
1. Load .env
2. Validasi environment variables (JWT_SECRET, DATABASE_URL, AI_INTERNAL_API_KEY)
3. Set body size limit 1MB
4. Pasang cookie parser
5. Pasang Helmet + CSP headers (amankan dari XSS, clickjacking)
6. Konfigurasi CORS (ketat: hanya origin yang terdaftar)
7. Pasang global error filters (3 filter, urut penting)
8. Pasang ValidationPipe (whitelist: true — buang field asing)
9. Pasang ResponseInterceptor (standarisasi output)
10. Setup Swagger docs
11. Jalan di port 8080

### `src/auth/auth.service.ts`
Otentikasi inti:
- **login()**: Cek username + password, deteksi akun terkunci (5 gagal = kunci 30 menit), generate JWT + refresh token
- **register()**: Transaksi atomik — bikin PlatformUser + Tenant + TenantUser + TenantMember sekaligus
- **googleLogin()**: Verifikasi ID token Google, cari atau buat PlatformUser, return platform JWT (5 menit expiry)
- **createStore()**: Transaksi atomik — bikin Tenant + TenantUser + TenantMember, set HttpOnly cookies

### `src/inventory/inventory.service.ts`
Logic inventaris:
- **adjustStock()**: Tambah/kurang stok, validasi stok ga boleh negatif, catat transaksi
- **aiProductInput()**: Input produk massal. Auto-create kategori & supplier kalo belum ada. Skip kalo SKU duplikat
- **getLowStockProducts()**: Query SQL raw: produk dimana stockQuantity <= reorderLevel

### `src/common/interceptors/response.interceptor.ts`
Standarisasi response. SEMUA endpoint return:
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-05-07T..."
}
```
Kalo error:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "timestamp": "2026-05-07T..."
}
```

### `crack-ai/ai_service.py`
AI chat logic:
- Panggil LLM (DeepSeek) dengan system prompt + tool definitions
- Eksekusi tool function sesuai request AI (read-only ke database)
- **validate_response()**: Filter output — cegah prompt injection attack
- Return reply text + tools yang dipake

### `crack-ai/main.py`
FastAPI app:
- `POST /chat` — Chat dengan AI (JWT required)
- `POST /ai/product-from-image` — Upload foto barang, AI identifikasi produk (ADMIN only, BARU)
- `GET /health` — Health check

---

## 🔐 Alur Autentikasi

### Cara Lama (Masih Bisa)
```
Register → bikin PlatformUser + Tenant + TenantUser langsung
Login → username + password → cookie auth_token (HttpOnly, 15 menit)
```

### Cara Baru (Google OAuth)
```
Step 1: POST /auth/google → Google login → platform JWT (5 menit)
Step 2: POST /auth/create-store → bikin toko → tenant JWT (15 menit) + cookie
Step 3: Akses dashboard
```

### Keamanan Auth
- **HttpOnly cookie**: Token ga bisa dicuri JavaScript (XSS)
- **CSRF double-submit**: Setiap mutation butuh X-CSRF-Token header
- **Refresh token rotation**: Token lama dicabut pas refresh
- **Rate limit**: 10 request/menit untuk auth, 60/menit general
- **Brute force protection**: Akun terkunci 30 menit setelah 5 gagal login

---

## 🔒 Fitur Keamanan

| Fitur | Implementasi |
|---|---|
| CSP headers | helmet() + contentSecurityPolicy |
| CORS strict | Hanya origin terdaftar |
| Body limit | 1MB — tolak payload gede |
| Input sanitasi | Hapus tag HTML dari semua input |
| Error detail | Stack trace hanya di development |
| CSRF | Double-submit cookie |
| SQL injection | Dicegah Prisma (parameterized queries) |
| XSS | HttpOnly cookie + sanitasi middleware |
| Helmet | Security headers (X-Frame-Options, X-Content-Type-Options) |
| AI output guard | validate_response() cegah prompt injection |
| AI audit log | Semua chat dicatat di tabel ai_audit_logs |
| Tenant isolation | Setiap query difilter tenantId |

---

## 🔌 API Endpoints Lengkap

### Public (Ga Pake Auth)
| Method | Path | Deskripsi |
|---|---|---|
| POST | /auth/register | Daftar toko baru |
| POST | /auth/login | Login user toko |
| POST | /auth/google | Login via Google (BARU) |
| GET | /auth/csrf-token | Ambil CSRF token |
| POST | /auth/refresh | Refresh access token |
| GET | /health | Cek server & database |

### Auth (Pake JWT)
| Method | Path | Deskripsi |
|---|---|---|
| POST | /auth/create-store | Buat toko setelah Google login (BARU) |
| POST | /auth/logout | Logout |

### Produk
| Method | Path | Akses |
|---|---|---|
| GET | /products | Semua user |
| GET | /products/:id | Semua user |
| POST | /products | Admin |
| PATCH | /products/:id | Admin |
| DELETE | /products/:id | Admin |

### Penjualan
| Method | Path | Akses |
|---|---|---|
| POST | /sales | Staff+ |
| POST | /sales/pending | Staff+ |
| GET | /sales | Semua user |
| GET | /sales/:id | Semua user |
| PATCH | /sales/:id/complete | Staff+ |
| PATCH | /sales/:id/cancel | Staff+ |

### Inventaris
| Method | Path | Akses |
|---|---|---|
| POST | /inventory/adjust | Admin |
| GET | /inventory/low-stock | Semua user |
| POST | /inventory/ai-input | Staff+ (BARU) |

### Dashboard (Semua User)
| Method | Path |
|---|---|
| GET | /dashboard/summary |
| GET | /dashboard/top-products |
| GET | /dashboard/sales-trend |
| GET | /dashboard/inventory-value |

### Super Admin
| Method | Path |
|---|---|
| POST | /admin/login |
| GET | /admin/tenants |
| GET | /admin/tenants/:id |
| DELETE | /admin/tenants/:id |
| GET | /admin/stats |

### AI Chat
| Method | Path |
|---|---|
| POST | /ai/chat |
| GET | /ai/chat/history |

### AI Service Langsung (Python FastAPI, port 8001)
| Method | Path |
|---|---|
| POST | /chat |
| POST | /ai/product-from-image (BARU) |
| GET | /health |

---

## 🚀 Cara Jalanin

### Docker (Rekomendasi)
```bash
cd crack-be/crack-be-yogaaaa123
docker compose build
docker compose up -d
# → BE: http://localhost:8080
# → AI: http://localhost:8001
# → DB: localhost:5432
```

### Local Development (Hot Reload)
```bash
# 1. Jalanin DB dulu (Docker)
docker compose up -d db

# 2. Jalanin backend
npm install
npx prisma migrate dev
npm run start:dev

# 3. Jalanin AI (terminal terpisah)
cd crack-ai
source .venv/bin/activate
uv run uvicorn main:app --reload --port 8001
```

### Testing
```bash
npm test          # Unit tests (92/97 pass — 5 gagal pre-existing mock)
npm run test:e2e  # E2E tests
```

---

## 🔧 Environment Variables

`.env`:
```
DATABASE_URL=postgresql://postgres:pass@localhost:5432/inventory_db
JWT_SECRET=your-strong-secret
AI_INTERNAL_API_KEY=your-ai-key
AI_SERVICE_URL=http://localhost:8001
GOOGLE_CLIENT_ID=your-google-client-id    # WAJIB untuk Google OAuth
LLM_API_KEY=sk-your-key                    # WAJIB untuk AI
ALLOWED_ORIGINS=http://localhost:3001
NODE_ENV=development
```
