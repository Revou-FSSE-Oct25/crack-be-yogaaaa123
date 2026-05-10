# 🧪 API Testing Guide — CrackPOS Backend

## 📋 Prasyarat

### A. Setup Backend (NestJS)

1. **Setup Environment**

   ```bash
   cd crack-be-yogaaaa123
   cp .env.example .env
   ```

   Edit `.env`:
   - `DATABASE_URL` — isi dengan URL PostgreSQL kamu
   - `JWT_SECRET` — isi dengan secret random (min 64 chars)
   - `DEFAULT_ADMIN_PASSWORD` & `DEFAULT_STAFF_PASSWORD` — isi password
   - `AI_INTERNAL_API_KEY` — isi key (contoh: `crack-ai-internal-key-dev`)

2. **Install dependencies & Run**
   ```bash
   npm install
   npx prisma migrate dev
   npx prisma db seed
   npm run start:dev
   ```
   Server akan jalan di `http://localhost:3000`
   Swagger UI: `http://localhost:3000/api`

### B. Setup AI Service (Python — FastAPI)

> **⚠️ Syarat:** Python 3.12+ dan [uv](https://docs.astral.sh/uv/) harus terinstall.

1. **Setup Environment AI**

   ```bash
   cd crack-be-yogaaaa123/crack-ai
   cp .env.example .env
   ```

   Edit `crack-ai/.env`:
   - `DATABASE_URL` — **SAMA** dengan yang di backend `.env`
   - `JWT_SECRET` — **HARUS SAMA PERSIS** dengan `JWT_SECRET` di backend `.env`
   - `LLM_API_KEY` — isi dengan API key dari DeepSeek (daftar di https://platform.deepseek.com/api_keys)
   - `INTERNAL_API_KEY` — isi dengan key yang **SAMA** dengan `AI_INTERNAL_API_KEY` di backend `.env`
   - `BACKEND_URL` — URL backend NestJS (default: `http://localhost:8000`, ganti jadi `http://localhost:3000`)
   - `BACKEND_INTERNAL_API_KEY` — isi **SAMA** dengan `INTERNAL_API_KEY` di atas

2. **Install dependencies & Run AI Service**
   ```bash
   cd crack-be-yogaaaa123/crack-ai
   uv sync
   uv run uvicorn main:app --reload --port 8001
   ```
   AI Service akan jalan di `http://localhost:8001`
   AI Health Check: `http://localhost:8001/health`

### C. Base URL

- **Backend API:** `http://localhost:3000`
- **AI Service:** `http://localhost:8001`
- **Swagger UI:** `http://localhost:3000/api`

---

## 📌 Daftar Isi

| #   | Modul                                       | Endpoint                                            |
| --- | ------------------------------------------- | --------------------------------------------------- |
| 1   | [Auth](#1-auth)                             | Register, Login, Refresh, Logout                    |
| 2   | [Admin (Super Admin)](#2-admin-super-admin) | Login, Tenants, Stats                               |
| 3   | [Users](#3-users)                           | CRUD Users, Change Password                         |
| 4   | [Categories](#4-categories)                 | CRUD Categories                                     |
| 5   | [Suppliers](#5-suppliers)                   | CRUD Suppliers                                      |
| 6   | [Products](#6-products)                     | CRUD Products                                       |
| 7   | [Inventory](#7-inventory)                   | Adjust Stock, Low Stock, Reorder Check              |
| 8   | [Sales](#8-sales)                           | Create Sales, Pending, Complete, Cancel             |
| 9   | [Purchase](#9-purchase)                     | Create PO, Pending, Receive, Cancel                 |
| 10  | [Returns](#10-returns)                      | Create Return, List Returns                         |
| 11  | [Dashboard](#11-dashboard)                  | Summary, Top Products, Sales Trend, Inventory Value |
| 12  | [Reports](#12-reports)                      | Sales, Inventory, Profit & Loss, CSV Export         |
| 13  | [Upload](#13-upload)                        | Upload Image                                        |
| 14  | [Activity Logs](#14-activity-logs)          | List & Detail Logs                                  |
| 15  | [Health](#15-health)                        | Health Check                                        |
| 16  | [AI Chat](#16-ai-chat)                      | Chat with AI Assistant                              |

---

## 1️⃣ Auth

### 1.1 Register Toko Baru

**POST** `{{base_url}}/auth/register`

```json
{
  "storeName": "Toko Sembako Makmur",
  "username": "admin",
  "email": "owner@email.com",
  "password": "StrongP@ss123"
}
```

**Response (201):**

```json
{
  "message": "Registrasi berhasil",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "a1b2c3d4e5f6...",
  "expires_in": 900,
  "user": {
    "id": "uuid-user-1",
    "username": "admin",
    "role": "ADMIN",
    "tenantId": "uuid-tenant-1",
    "storeName": "Toko Sembako Makmur"
  }
}
```

### 1.2 Login

**POST** `{{base_url}}/auth/login`

```json
{
  "username": "admin1",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "a1b2c3d4e5f6...",
  "expires_in": 900,
  "user": {
    "id": "uuid-user-1",
    "username": "admin1",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

> **Simpan `access_token` dan `refresh_token`** — akan dipakai di semua endpoint berikutnya.

### 1.3 Refresh Token

**POST** `{{base_url}}/auth/refresh`

**Headers:**

```
x-refresh-token: <refresh_token_dari_login>
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "a1b2c3d4e5f6...",
  "expires_in": 900
}
```

### 1.4 Logout

**POST** `{{base_url}}/auth/logout`

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "message": "Logged out successfully"
}
```

---

## 2️⃣ Admin (Super Admin)

### 2.1 Login Super Admin

**POST** `{{base_url}}/admin/login`

```json
{
  "email": "superadmin@crack.com",
  "password": "SuperAdmin@123"
}
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "a1b2c3d4e5f6...",
  "expires_in": 900,
  "user": {
    "id": "uuid-admin",
    "email": "superadmin@crack.com",
    "name": "Super Admin",
    "role": "SUPER_ADMIN",
    "isSuperAdmin": true
  }
}
```

### 2.2 Daftar Semua Tenant

**GET** `{{base_url}}/admin/tenants?skip=0&take=10`

**Headers:**

```
Authorization: Bearer <super_admin_token>
```

### 2.3 Detail Tenant

**GET** `{{base_url}}/admin/tenants/:id`

### 2.4 Hapus Tenant (Soft Delete)

**DELETE** `{{base_url}}/admin/tenants/:id`

### 2.5 Statistik Platform

**GET** `{{base_url}}/admin/stats`

---

## 3️⃣ Users

> **Semua endpoint Users membutuhkan role ADMIN**

### 3.1 Buat User Baru

**POST** `{{base_url}}/users`

```json
{
  "username": "staffbaru",
  "password": "password123",
  "role": "STAFF"
}
```

### 3.2 Daftar Semua Users

**GET** `{{base_url}}/users?skip=0&take=10`

### 3.3 Detail User

**GET** `{{base_url}}/users/:id`

### 3.4 Update User

**PATCH** `{{base_url}}/users/:id`

```json
{
  "role": "ADMIN"
}
```

### 3.5 Hapus User (Soft Delete)

**DELETE** `{{base_url}}/users/:id`

### 3.6 Ganti Password Sendiri

**PATCH** `{{base_url}}/users/:id/change-password`

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456!"
}
```

> **Catatan:** User hanya bisa ganti password mereka SENDIRI (`:id` harus sama dengan ID user yang login).

---

## 4️⃣ Categories

### 4.1 Buat Kategori

**POST** `{{base_url}}/categories`

```json
{
  "name": "Electronics",
  "description": "Electronic gadgets and devices"
}
```

### 4.2 Daftar Semua Kategori

**GET** `{{base_url}}/categories?skip=0&take=10`

### 4.3 Detail Kategori

**GET** `{{base_url}}/categories/:id`

### 4.4 Update Kategori

**PATCH** `{{base_url}}/categories/:id`

```json
{
  "name": "Elektronik",
  "description": "Alat elektronik dan gadget"
}
```

### 4.5 Hapus Kategori

**DELETE** `{{base_url}}/categories/:id`

---

## 5️⃣ Suppliers

### 5.1 Buat Supplier

**POST** `{{base_url}}/suppliers`

```json
{
  "name": "Tech Corp",
  "contactName": "John Doe",
  "phone": "+1234567890",
  "email": "contact@techcorp.com",
  "address": "123 Tech Lane, Silicon Valley"
}
```

### 5.2 Daftar Semua Supplier

**GET** `{{base_url}}/suppliers?skip=0&take=10`

### 5.3 Detail Supplier

**GET** `{{base_url}}/suppliers/:id`

### 5.4 Update Supplier

**PATCH** `{{base_url}}/suppliers/:id`

```json
{
  "name": "Tech Corp Updated",
  "phone": "+9876543210"
}
```

### 5.5 Hapus Supplier

**DELETE** `{{base_url}}/suppliers/:id`

---

## 6️⃣ Products

### 6.1 Buat Produk

**POST** `{{base_url}}/products`

```json
{
  "sku": "SKU-1001",
  "name": "iPhone 15",
  "description": "Latest Apple Smartphone",
  "price": "999.99",
  "stockQuantity": 50,
  "reorderLevel": 10,
  "categoryId": "uuid-category-id",
  "supplierId": "uuid-supplier-id"
}
```

> **Catatan:** `categoryId` dan `supplierId` opsional. Isi dengan UUID dari kategori/supplier yang sudah dibuat.

### 6.2 Daftar Semua Produk (dengan Filter)

**GET** `{{base_url}}/products?skip=0&take=10&search=iphone&categoryId=xxx&supplierId=xxx`

| Parameter    | Tipe   | Keterangan                     |
| ------------ | ------ | ------------------------------ |
| `skip`       | number | Data yang dilewati             |
| `take`       | number | Jumlah data (default: 50)      |
| `search`     | string | Cari berdasarkan nama atau SKU |
| `categoryId` | string | Filter by kategori             |
| `supplierId` | string | Filter by supplier             |

### 6.3 Detail Produk

**GET** `{{base_url}}/products/:id`

### 6.4 Update Produk

**PATCH** `{{base_url}}/products/:id`

```json
{
  "name": "iPhone 15 Pro",
  "price": "1299.99",
  "stockQuantity": 100
}
```

### 6.5 Hapus Produk

**DELETE** `{{base_url}}/products/:id`

---

## 7️⃣ Inventory

### 7.1 Adjust Stok Manual

**POST** `{{base_url}}/inventory/adjust`

```json
{
  "productId": "uuid-product-id",
  "quantityChange": 10,
  "type": "ADJUSTMENT",
  "referenceId": "REF-001",
  "notes": "Manual stock correction"
}
```

| Field            | Keterangan                                                |
| ---------------- | --------------------------------------------------------- |
| `quantityChange` | **POSITIVE** = nambah stok, **NEGATIVE** = ngurangin stok |
| `type`           | `ADJUSTMENT`, `DAMAGED`, `LOST`, `FOUND`, `MANUAL`        |

### 7.2 Produk Low Stock

**GET** `{{base_url}}/inventory/low-stock`

### 7.3 Cek Reorder Level

**GET** `{{base_url}}/inventory/check-reorder/:productId`

---

## 8️⃣ Sales

### 8.1 Buat Transaksi Penjualan (COMPLETED — langsung kurangi stok)

**POST** `{{base_url}}/sales`

```json
{
  "orderNumber": "SO-1001",
  "customerId": "CUST-001",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 2,
      "unitPrice": "999.99"
    }
  ]
}
```

### 8.2 Buat Transaksi PENDING (tidak kurangi stok)

**POST** `{{base_url}}/sales/pending`

```json
{
  "orderNumber": "SO-1002",
  "customerId": "CUST-002",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 1,
      "unitPrice": "999.99"
    }
  ]
}
```

### 8.3 Complete Pending Sales Order

**PATCH** `{{base_url}}/sales/:id/complete`

### 8.4 Daftar Semua Sales Orders

**GET** `{{base_url}}/sales?skip=0&take=10&status=COMPLETED&customerId=xxx`

### 8.5 Detail Sales Order

**GET** `{{base_url}}/sales/:id`

### 8.6 Batalkan PENDING Sales Order

**PATCH** `{{base_url}}/sales/:id/cancel`

---

## 9️⃣ Purchase

> **Semua endpoint Purchase membutuhkan role ADMIN**

### 9.1 Buat Purchase Order (RECEIVED — langsung tambah stok)

**POST** `{{base_url}}/purchase`

```json
{
  "orderNumber": "PO-2001",
  "supplierId": "uuid-supplier-id",
  "notes": "Urgent restock",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 50,
      "unitPrice": "800.00"
    }
  ]
}
```

### 9.2 Buat Purchase Order PENDING (tidak tambah stok)

**POST** `{{base_url}}/purchase/pending`

```json
{
  "orderNumber": "PO-2002",
  "supplierId": "uuid-supplier-id",
  "items": [
    {
      "productId": "uuid-product-id",
      "quantity": 30,
      "unitPrice": "750.00"
    }
  ]
}
```

### 9.3 Terima Purchase Order (PENDING → RECEIVED)

**PATCH** `{{base_url}}/purchase/:id/receive`

### 9.4 Daftar Semua Purchase Orders

**GET** `{{base_url}}/purchase?supplierId=xxx&status=PENDING&skip=0&take=10`

### 9.5 Ringkasan Pembelian dari Supplier

**GET** `{{base_url}}/purchase/supplier-summary/:supplierId`

### 9.6 Detail Purchase Order

**GET** `{{base_url}}/purchase/:id`

### 9.7 Batalkan Purchase Order PENDING

**PATCH** `{{base_url}}/purchase/:id/cancel`

---

## 🔟 Returns

### 10.1 Buat Return Barang

**POST** `{{base_url}}/returns`

```json
{
  "returnNumber": "RET-1001",
  "salesOrderId": "uuid-sales-order-id",
  "reason": "Customer received damaged item",
  "items": [
    {
      "orderItemId": "uuid-order-item-id",
      "quantity": 1
    }
  ]
}
```

> **Catatan:** `orderItemId` adalah ID dari item di sales order (bukan productId). Bisa dilihat di response detail sales order.

### 10.2 Daftar Semua Returns

**GET** `{{base_url}}/returns?skip=0&take=10`

### 10.3 Detail Return

**GET** `{{base_url}}/returns/:id`

---

## 1️⃣1️⃣ Dashboard

### 11.1 Ringkasan Dashboard

**GET** `{{base_url}}/dashboard/summary`

**Response:**

```json
{
  "totalProducts": 150,
  "totalSales": 1200,
  "totalRevenue": 50000000,
  "totalProfit": 10000000,
  "lowStockCount": 5,
  "recentSales": [...]
}
```

### 11.2 Produk Terlaris

**GET** `{{base_url}}/dashboard/top-products?limit=10`

### 11.3 Tren Penjualan

**GET** `{{base_url}}/dashboard/sales-trend?days=30`

### 11.4 Total Nilai Inventory

**GET** `{{base_url}}/dashboard/inventory-value`

---

## 1️⃣2️⃣ Reports

> **Semua endpoint Reports membutuhkan role ADMIN**

### 12.1 Laporan Penjualan

**GET** `{{base_url}}/reports/sales?startDate=2026-01-01&endDate=2026-05-02`

### 12.2 Laporan Inventory

**GET** `{{base_url}}/reports/inventory`

### 12.3 Laporan Laba/Rugi

**GET** `{{base_url}}/reports/profit-loss?startDate=2026-01-01&endDate=2026-05-02`

### 12.4 Export Sales CSV

**GET** `{{base_url}}/reports/sales/csv?startDate=2026-01-01&endDate=2026-05-02`

> **Cara pakai:** Buka URL langsung di browser → auto download file `sales-report.csv`

### 12.5 Export Inventory CSV

**GET** `{{base_url}}/reports/inventory/csv`

### 12.6 Export Profit & Loss CSV

**GET** `{{base_url}}/reports/profit-loss/csv?startDate=2026-01-01&endDate=2026-05-02`

---

## 1️⃣3️⃣ Upload

### 13.1 Upload Image Produk

**POST** `{{base_url}}/upload/image`

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Body (form-data):**
| Key | Value |
|-----|-------|
| `file` | (pilih file gambar) |

**Response:**

```json
{
  "filename": "abc123.jpg",
  "originalname": "product.jpg",
  "size": 12345,
  "mimetype": "image/jpeg",
  "url": "http://localhost:3000/uploads/abc123.jpg"
}
```

---

## 1️⃣4️⃣ Activity Logs

> **Semua endpoint Activity Logs membutuhkan role ADMIN**

### 14.1 Semua Activity Logs

**GET** `{{base_url}}/activity-logs?skip=0&take=10`

### 14.2 Detail Activity Log

**GET** `{{base_url}}/activity-logs/:id`

---

## 1️⃣5️⃣ Health

### 15.1 Health Check

**GET** `{{base_url}}/health`

**Response (200):**

```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  }
}
```

---

## 1️⃣6️⃣ AI Chat

### 16.1 Chat dengan AI Assistant

**POST** `{{base_url}}/ai/chat`

```json
{
  "message": "Tampilkan produk yang stoknya mau habis",
  "history": []
}
```

**Response:**

```json
{
  "reply": "Berikut adalah produk dengan stok menipis:\n1. **iPhone 15** - Stok: 3 (Re-order: 10)\n2. **Samsung Galaxy** - Stok: 5 (Re-order: 8)",
  "toolsUsed": ["get_low_stock_products"]
}
```

**Contoh pertanyaan lain:**

- "Berapa total revenue bulan ini?"
- "Produk apa yang paling laris?"
- "Tolong cari produk dengan nama 'iPhone'"
- "Bagaimana laporan penjualan minggu ini?"
- "Siapa saja supplier yang terdaftar?"

---

## 🎯 Alur Test Lengkap (Urutan yang Disarankan)

### Flow 1: Auth & Master Data

```
1. POST /auth/register          → Daftar toko baru (dapat token)
2. POST /auth/login              → Login (dapat access_token & refresh_token)
3. POST /categories              → Buat kategori "Electronics"
4. POST /categories              → Buat kategori "Food & Beverage"
5. POST /suppliers               → Buat supplier "Tech Corp"
6. POST /suppliers               → Buat supplier "Food Supplier"
7. POST /products                → Buat produk "iPhone 15" (categoryId, supplierId)
8. POST /products                → Buat produk "Samsung Galaxy"
9. GET  /products?search=iphone  → Cari produk
10. GET  /products               → Daftar semua produk
```

### Flow 2: Transaksi

```
11. POST /purchase               → Beli stok (PO langsung RECEIVED)
12. POST /purchase/pending       → Buat PO PENDING
13. PATCH /purchase/:id/receive  → Terima PO PENDING
14. GET  /purchase               → Daftar semua PO
15. POST /sales                  → Jual produk (langsung COMPLETED)
16. POST /sales/pending          → Buat sales PENDING
17. PATCH /sales/:id/complete    → Complete sales PENDING
18. GET  /sales                  → Daftar semua sales
```

### Flow 3: Inventory & Returns

```
19. GET  /inventory/low-stock    → Cek produk low stock
20. GET  /inventory/check-reorder/:productId → Cek reorder
21. POST /inventory/adjust       → Adjust stok manual
22. POST /returns                → Return barang (butuh salesOrderId & orderItemId)
23. GET  /returns                → Daftar returns
```

### Flow 4: Dashboard & Reports

```
24. GET  /dashboard/summary      → Ringkasan dashboard
25. GET  /dashboard/top-products → Produk terlaris
26. GET  /dashboard/sales-trend  → Tren penjualan
27. GET  /dashboard/inventory-value → Nilai inventory
28. GET  /reports/sales          → Laporan penjualan
29. GET  /reports/profit-loss    → Laporan laba rugi
30. GET  /reports/inventory      → Laporan inventory
```

### Flow 5: Admin & Users

```
31. POST /admin/login            → Login Super Admin
32. GET  /admin/tenants          → Daftar semua tenant
33. GET  /admin/stats            → Statistik platform
34. POST /users                  → Buat user STAFF baru
35. GET  /users                  → Daftar semua users
36. PATCH /users/:id/change-password → Ganti password
37. GET  /activity-logs          → Lihat activity logs
```

### Flow 6: AI & Upload

```
38. POST /ai/chat                → Tanya AI asisten
39. POST /upload/image           → Upload gambar produk (multipart/form-data)
```

### Flow 7: Token Management

```
40. POST /auth/refresh           → Refresh token (pake x-refresh-token header)
41. POST /auth/logout            → Logout (revoke semua refresh token)
```

---

## ⚠️ Catatan Penting

1. **Authorization Header:** Semua endpoint (kecuali auth & health) butuh:

   ```
   Authorization: Bearer <access_token>
   ```

2. **Rate Limit:**
   - Global: 60 request per 60 detik
   - Auth endpoints: 10 request per 60 detik
   - Register: 5 request per 60 detik
   - AI Chat: 10 request per 60 detik

3. **UUID:** Semua ID menggunakan UUID. Setelah create data, simpan ID-nya untuk dipakai di endpoint berikutnya.

4. **Soft Delete:** Delete pada users, products, categories, suppliers adalah soft delete (set `deletedAt`).

5. **Swagger UI:** Buka `http://localhost:3000/api` untuk dokumentasi interaktif — bisa test langsung dari browser!
