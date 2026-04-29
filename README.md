# Inventory Management API

Enterprise-grade inventory management backend built with **NestJS**, **Prisma**, and **PostgreSQL**.

---

## 🚀 Quick Start

```bash
# 1. Clone & install
npm install
# or
pnpm install

# 2. Copy environment
cp .env.example .env
# Edit .env with your database URL and secrets

# 3. Run database migration
npx prisma migrate dev

# 4. Seed default users
npx prisma db seed

# 5. Start development server
npm run start:dev
```

---

## 🧩 Tech Stack

| Layer       | Tech                               |
| ----------- | ---------------------------------- |
| Framework   | NestJS v11                         |
| Database    | PostgreSQL                         |
| ORM         | Prisma v7                          |
| Auth        | JWT (Passport) + bcrypt            |
| Validation  | class-validator + class-transformer |
| API Docs    | Swagger (OpenAPI)                  |
| Rate Limit  | @nestjs/throttler                  |
| File Upload | Multer                             |

---

## 📁 Project Structure

```
src/
├── app.module.ts              # Root module
├── main.ts                    # Bootstrap (CORS, Swagger, Validation, Interceptors)
├── prisma.service.ts          # Prisma client service
├── prisma.module.ts           # Prisma module (shared)
│
├── auth/                      # Authentication
│   ├── auth.module.ts
│   ├── auth.controller.ts     # POST /auth/login
│   ├── auth.service.ts
│   ├── dto/login.dto.ts
│   └── strategies/
│       └── jwt.strategy.ts
│
├── users/                     # User management (Admin only)
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── users.service.ts
│
├── categories/                # Product categories
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   └── categories.service.ts
│
├── suppliers/                 # Supplier management
│   ├── suppliers.module.ts
│   ├── suppliers.controller.ts
│   └── suppliers.service.ts
│
├── products/                  # Product catalog (with pagination & search)
│   ├── products.module.ts
│   ├── products.controller.ts
│   └── products.service.ts
│
├── inventory/                 # Stock transactions & adjustments
│   ├── inventory.module.ts
│   ├── inventory.controller.ts
│   └── inventory.service.ts
│
├── sales/                     # Sales orders
│   ├── sales.module.ts
│   ├── sales.controller.ts
│   └── sales.service.ts
│
├── purchase/                  # Purchase orders (from suppliers)
│   ├── purchase.module.ts
│   ├── purchase.controller.ts
│   └── purchase.service.ts
│
├── returns/                   # Sales returns (with stock reversal & financial correction)
│   ├── returns.module.ts
│   ├── returns.controller.ts
│   └── returns.service.ts
│
├── activity-log/              # Audit trail / activity logging
│   ├── activity-log.module.ts
│   ├── activity-log.controller.ts
│   └── activity-log.service.ts
│
├── dashboard/                 # Dashboard summary & analytics
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts
│   └── dashboard.service.ts
│
├── reports/                   # Reports (Admin only)
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   └── reports.service.ts
│
├── upload/                    # File uploads (product images)
│   ├── upload.module.ts
│   └── upload.controller.ts
│
├── health/                    # Health check endpoint
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── prisma.health.ts
│
└── common/                    # Shared utilities
    ├── decorators/
    │   ├── current-user.decorator.ts
    │   └── roles.decorator.ts
    ├── filters/
    │   └── prisma-client-exception.filter.ts
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   └── roles.guard.ts
    └── interceptors/
        ├── response.interceptor.ts
        └── cache.interceptor.ts
```

---

## 🔌 API Endpoints

### 🔐 Authentication
| Method | Path            | Auth     | Description      |
| ------ | --------------- | -------- | ---------------- |
| POST   | `/auth/login`   | Public   | Login, get JWT   |

### 👥 Users (Admin Only)
| Method | Path                               | Auth    | Description                  |
| ------ | ---------------------------------- | ------- | ---------------------------- |
| POST   | `/users`                           | Admin   | Create user                  |
| GET    | `/users`                           | Admin   | List all users (paginated)   |
| GET    | `/users/:id`                       | Admin   | Get user by ID               |
| PATCH  | `/users/:id`                       | Admin   | Update user                  |
| DELETE | `/users/:id`                       | Admin   | Soft delete user             |
| PATCH  | `/users/:id/change-password`       | JWT     | Change own password          |

### 🏷️ Categories
| Method | Path                | Auth       | Description                     |
| ------ | ------------------- | ---------- | ------------------------------- |
| POST   | `/categories`       | Admin      | Create category                 |
| GET    | `/categories`       | JWT        | List all (paginated)            |
| GET    | `/categories/:id`   | JWT        | Get by ID                       |
| PATCH  | `/categories/:id`   | Admin      | Update category                 |
| DELETE | `/categories/:id`   | Admin      | Soft delete category            |

### 📦 Products
| Method | Path              | Auth       | Description                                  |
| ------ | ----------------- | ---------- | -------------------------------------------- |
| POST   | `/products`       | Admin      | Create product                               |
| GET    | `/products`       | JWT        | List all (`?search=&categoryId=&supplierId=&skip=&take=`) |
| GET    | `/products/:id`   | JWT        | Get by ID                                    |
| PATCH  | `/products/:id`   | Admin      | Update product                               |
| DELETE | `/products/:id`   | Admin      | Soft delete product                          |

### 📊 Inventory / Stock
| Method | Path                         | Auth       | Description                         |
| ------ | ---------------------------- | ---------- | ----------------------------------- |
| GET    | `/inventory`                 | JWT        | List stock transactions (paginated) |
| GET    | `/inventory/stock`           | JWT        | Get current stock for all products  |
| POST   | `/inventory/adjust`          | Admin/Staff| Adjust stock (IN/OUT/ADJUSTMENT)    |

### 🛒 Sales Orders
| Method | Path                 | Auth       | Description                     |
| ------ | -------------------- | ---------- | ------------------------------- |
| POST   | `/sales`             | Admin/Staff| Create sales order              |
| GET    | `/sales`             | JWT        | List sales orders (paginated)   |
| GET    | `/sales/:id`         | JWT        | Get by ID                       |
| PATCH  | `/sales/:id/status`  | Admin/Staff| Update order status             |

### 🚚 Purchase Orders
| Method | Path                   | Auth       | Description                         |
| ------ | ---------------------- | ---------- | ----------------------------------- |
| POST   | `/purchase`            | Admin/Staff| Create purchase order               |
| GET    | `/purchase`            | JWT        | List purchase orders (paginated)    |
| GET    | `/purchase/:id`        | JWT        | Get by ID                           |
| PATCH  | `/purchase/:id/status` | Admin/Staff| Receive / cancel purchase order     |

### ↩️ Sales Returns
| Method | Path            | Auth       | Description                         |
| ------ | --------------- | ---------- | ----------------------------------- |
| POST   | `/returns`      | Admin/Staff| Create return (auto stock reversal) |
| GET    | `/returns`      | JWT        | List returns (paginated)            |
| GET    | `/returns/:id`  | JWT        | Get by ID                           |

### 📋 Activity Logs (Admin Only)
| Method | Path                    | Auth  | Description                 |
| ------ | ----------------------- | ----- | --------------------------- |
| GET    | `/activity-logs`        | Admin | List all activity logs      |
| GET    | `/activity-logs/:id`    | Admin | Get by ID                   |

### 📈 Dashboard (Admin & Staff)
| Method | Path                          | Auth  | Description                         |
| ------ | ----------------------------- | ----- | ----------------------------------- |
| GET    | `/dashboard/summary`          | JWT   | Counts, revenue, low stock          |
| GET    | `/dashboard/top-products`     | JWT   | Top selling products                |
| GET    | `/dashboard/sales-trend`      | JWT   | Sales trend over last N days        |
| GET    | `/dashboard/inventory-value`  | JWT   | Total stock count                   |

### 📑 Reports (Admin Only)
| Method | Path                     | Auth  | Description                      |
| ------ | ------------------------ | ----- | -------------------------------- |
| GET    | `/reports/sales`         | Admin | Sales report (filter by date)    |
| GET    | `/reports/inventory`     | Admin | Full inventory report            |
| GET    | `/reports/profit-loss`   | Admin | Profit & loss report             |

### 📤 Upload (Admin Only)
| Method | Path             | Auth  | Description               |
| ------ | ---------------- | ----- | ------------------------- |
| POST   | `/upload/image`  | Admin | Upload product image      |

### ❤️ Health Check
| Method | Path       | Auth   | Description          |
| ------ | ---------- | ------ | -------------------- |
| GET    | `/health`  | Public | Health check + Prisma|

### 📖 API Documentation
| Method | Path    | Auth   | Description    |
| ------ | ------- | ------ | -------------- |
| GET    | `/api`  | Public | Swagger UI     |

---

## 🔐 Environment Variables

| Variable                 | Required | Default                    | Description                           |
| ------------------------ | -------- | -------------------------- | ------------------------------------- |
| `DATABASE_URL`           | ✅       | -                          | PostgreSQL connection string          |
| `JWT_SECRET`             | ✅       | -                          | JWT signing secret (min 64 chars)     |
| `PORT`                   | ❌       | `3000`                     | Server port                           |
| `ALLOWED_ORIGINS`        | ❌       | `http://localhost:5173,...`| CORS allowed origins                  |
| `DEFAULT_ADMIN_PASSWORD` | ❌       | -                          | Seed admin password                   |
| `DEFAULT_STAFF_PASSWORD` | ❌       | -                          | Seed staff password                   |
| `UPLOAD_DIR`             | ❌       | `./uploads`                | Upload directory for product images   |

---

## 🗃️ Database Schema

- **User** — Users with roles (ADMIN / STAFF)
- **Product** — Product catalog with SKU, price, stock, image
- **Category** — Product categories
- **Supplier** — Supplier information
- **StockTransaction** — Inventory ledger (IN/OUT/ADJUSTMENT/RETURN)
- **PurchaseOrder** / **PurchaseOrderItem** — Purchase orders from suppliers
- **SalesOrder** / **OrderItem** — Sales orders with COGS tracking
- **SalesReturn** / **SalesReturnItem** — Return management with financial correction
- **ActivityLog** — Audit trail for all CRUD operations
- **RefreshToken** — JWT refresh token storage

---

## 🧠 Key Features

- ✅ **Role-based access control** (ADMIN, STAFF) with guards
- ✅ **JWT authentication** with Passport strategy
- ✅ **Rate limiting** — separate limits for auth (10/min) and general (60/min)
- ✅ **Pagination** — all `GET /` endpoints return `{ data, total }`
- ✅ **Search & Filters** — products searchable by name/SKU, filterable by category/supplier
- ✅ **Soft delete** — all entities support `deletedAt`
- ✅ **Stock management** — automatic stock updates on sales, purchases, returns
- ✅ **COGS tracking** — profit margin calculated per order item
- ✅ **Return processing** — stock reversal and financial correction
- ✅ **Activity logging** — automatic audit trail
- ✅ **Dashboard API** — real-time summary, top products, sales trends
- ✅ **Reports** — sales, inventory, profit-loss filtering by date
- ✅ **File upload** — product image upload with validation (max 5MB, jpeg/png/gif/webp)
- ✅ **Swagger docs** — auto-generated at `/api`
- ✅ **Global response interceptor** — consistent JSON envelope `{ statusCode, message, data, timestamp }`
- ✅ **In-memory caching** — 30s TTL for GET endpoints
- ✅ **Prisma exception filter** — structured error responses

---

## 🐳 Docker

```bash
# Build image
docker build -t inventory-api .

# Run with PostgreSQL
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  inventory-api
```

---

## ⚡ Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run start:dev` | Start in watch mode                  |
| `npm run build`     | Build for production                 |
| `npm run start:prod`| Start production server              |
| `npm run lint`      | Lint all files                       |
| `npm run test`      | Run unit tests                       |
| `npm run test:e2e`  | Run e2e tests                        |
