# Comprehensive Test Suite for CrackPOS Backend

## TL;DR
> **Summary**: Implement complete test coverage (unit, integration, e2e) for NestJS CrackPOS backend — 17 controllers, 8 existing specs, multi-tenant auth, Prisma transactions, JWT guards, role-based access.
> **Deliverables**: 
> - Unit tests for all services (17 modules)
> - Integration tests for all controllers (17 controllers)
> - E2E tests for critical flows (auth, sales, purchase, inventory)
> - Guard/middleware/interceptor tests
> - Test utilities and fixtures
> **Effort**: Large
> **Parallel**: YES - 6 waves
> **Critical Path**: Wave 1 (test utilities) → Wave 2-5 (parallel tests) → Wave 6 (e2e)

## Context

### Original Request
User: "tolong buatkan skenario unit test e2e test dan test test lain nya di backend ku dalam bentuk plan biar nanti di jalankan sama ai model yg lebih murah dengan detail ya"

### Interview Summary
- Backend: NestJS + Prisma + PostgreSQL + JWT + Multi-tenant
- Existing: 8 spec files (auth, sales, purchase, returns, inventory, users, jwt-guard, public-decorator)
- Test framework: Jest + Supertest (already configured)
- Controllers: 17 (activity-log, admin, ai, ai-data, auth, categories, dashboard, health, inventory, products, purchase, reports, returns, sales, suppliers, upload, users)
- Guards: JwtAuthGuard, RolesGuard, TenantThrottlerGuard, PlatformJwtGuard, CsrfGuard
- Multi-tenant: tenantId isolation, per-user throttling
- Prisma models: Tenant, TenantUser, PlatformUser, Product, Category, Supplier, SalesOrder, PurchaseOrder, StockTransaction, SalesReturn, ActivityLog, RefreshToken

### Metis Review
- **Gap**: No integration tests for controllers (only unit tests for services exist)
- **Gap**: E2E tests only cover basic health + auth login — missing sales flow, purchase flow, inventory adjustments
- **Gap**: No tests for guards (RolesGuard, TenantThrottlerGuard, CsrfGuard)
- **Gap**: No tests for interceptors (ResponseInterceptor, AuditLogInterceptor, CacheInterceptor)
- **Gap**: No tests for middleware (SanitizeMiddleware)
- **Gap**: No test database seeding strategy
- **Guardrail**: Must use test database (not production)
- **Guardrail**: Must mock external services (AI API, file uploads)
- **Guardrail**: Must test multi-tenant isolation (no cross-tenant data leaks)

## Work Objectives

### Core Objective
Achieve 80%+ test coverage across unit, integration, and e2e tests for CrackPOS backend with focus on business-critical flows (auth, sales, purchase, inventory) and multi-tenant isolation.

### Deliverables
1. **Unit Tests** (17 service specs): All services have unit tests with mocked Prisma
2. **Integration Tests** (17 controller specs): All controllers tested with real NestJS TestingModule
3. **E2E Tests** (5 flow specs): Auth, Sales, Purchase, Inventory, Reports end-to-end flows
4. **Guard/Middleware Tests** (7 specs): All guards, interceptors, middleware tested
5. **Test Utilities**: Shared fixtures, factories, test database setup

### Definition of Done
- [ ] `npm run test` passes with 80%+ coverage
- [ ] `npm run test:e2e` passes all critical flows
- [ ] All 17 controllers have integration tests
- [ ] All services have unit tests with >80% branch coverage
- [ ] Multi-tenant isolation verified (no cross-tenant leaks)
- [ ] CI-ready (can run in GitHub Actions with test DB)

### Must Have
- Multi-tenant isolation tests (verify tenantId filtering)
- JWT auth tests (valid/invalid/expired tokens)
- Role-based access tests (ADMIN vs STAFF permissions)
- Prisma transaction tests (sales order creation with stock updates)
- Error handling tests (404, 400, 401, 403, 500)
- Input validation tests (DTO validation with class-validator)

### Must NOT Have
- No tests that mutate production database
- No hardcoded credentials in test files
- No tests that depend on external APIs (must mock)
- No flaky tests (use deterministic data, no random values)
- No AI slop patterns (no "should work correctly", use specific assertions)

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- **Test decision**: Tests-after (implementation already exists, adding tests retroactively)
- **Framework**: Jest (unit/integration) + Supertest (e2e)
- **QA policy**: Every task has agent-executed scenarios
- **Evidence**: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

**Wave 1: Test Infrastructure** (foundation - must complete first)
- Task 1: Test utilities and factories
- Task 2: Test database setup and seeding

**Wave 2: Service Unit Tests - Core Business Logic** (parallel)
- Task 3: Auth service unit tests
- Task 4: Sales service unit tests
- Task 5: Purchase service unit tests
- Task 6: Inventory service unit tests
- Task 7: Returns service unit tests

**Wave 3: Service Unit Tests - Supporting Modules** (parallel)
- Task 8: Products service unit tests
- Task 9: Categories service unit tests
- Task 10: Suppliers service unit tests
- Task 11: Users service unit tests
- Task 12: Dashboard service unit tests
- Task 13: Reports service unit tests

**Wave 4: Controller Integration Tests - Part 1** (parallel)
- Task 14: Auth controller integration tests
- Task 15: Sales controller integration tests
- Task 16: Purchase controller integration tests
- Task 17: Inventory controller integration tests
- Task 18: Returns controller integration tests

**Wave 5: Controller Integration Tests - Part 2** (parallel)
- Task 19: Products controller integration tests
- Task 20: Categories controller integration tests
- Task 21: Suppliers controller integration tests
- Task 22: Users controller integration tests
- Task 23: Dashboard controller integration tests
- Task 24: Reports controller integration tests
- Task 25: Upload controller integration tests

**Wave 6: Guards, Middleware, E2E** (depends on Wave 1-5)
- Task 26: Guards and middleware tests
- Task 27: Interceptors tests
- Task 28: E2E auth flow tests
- Task 29: E2E sales flow tests
- Task 30: E2E purchase flow tests
- Task 31: E2E inventory flow tests

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 | - | 2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31 |
| 2 | 1 | 28,29,30,31 |
| 3-13 | 1 | 14-25 |
| 14-25 | 1,3-13 | 26,27,28,29,30,31 |
| 26-27 | 1 | 28,29,30,31 |
| 28-31 | 1,2,14-27 | - |

### Agent Dispatch Summary
- Wave 1: 2 tasks → test-infrastructure, database-setup
- Wave 2: 5 tasks → core-services (auth, sales, purchase, inventory, returns)
- Wave 3: 6 tasks → supporting-services (products, categories, suppliers, users, dashboard, reports)
- Wave 4: 5 tasks → core-controllers (auth, sales, purchase, inventory, returns)
- Wave 5: 7 tasks → supporting-controllers (products, categories, suppliers, users, dashboard, reports, upload)
- Wave 6: 6 tasks → guards, interceptors, e2e-flows

## TODOs

- [ ] 1. Create Test Utilities and Factories

  **What to do**:
  - Create `src/test/utils/test-helpers.ts` with mock factories for all Prisma models
  - Create `src/test/utils/mock-prisma.ts` with typed Prisma mock generator
  - Create `src/test/fixtures/` with sample data (users, products, categories, suppliers)
  - Create `src/test/utils/auth-helpers.ts` with JWT token generation for tests
  - All factories must support multi-tenant (accept tenantId parameter)
  
  **Must NOT do**:
  - No hardcoded UUIDs (use faker or uuid library)
  - No production credentials
  - No real database connections in unit tests

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Utility code, no business logic
  - Skills: [`tdd-guide`] - For test patterns
  - Omitted: [`senior-backend`] - Not needed for test utilities

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: ALL | Blocked By: -

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-30` - Existing mock pattern (createMockUser, mockPrismaService)
  - Pattern: `src/sales/sales.service.spec.ts:1-40` - Prisma transaction mocking
  - External: https://jestjs.io/docs/mock-functions - Jest mocking guide

  **Acceptance Criteria**:
  - [ ] `src/test/utils/test-helpers.ts` exports factories for: User, Product, Category, Supplier, SalesOrder, PurchaseOrder
  - [ ] `src/test/utils/mock-prisma.ts` exports `createMockPrisma()` with all model methods
  - [ ] `src/test/fixtures/users.fixture.ts` exports ADMIN and STAFF sample users
  - [ ] `src/test/utils/auth-helpers.ts` exports `generateTestToken(user)` function
  - [ ] All factories accept `tenantId` parameter and return objects with that tenantId

  **QA Scenarios**:
  ```
  Scenario: Import and use test helpers
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. node -e "const { createMockUser } = require('./src/test/utils/test-helpers'); console.log(createMockUser({ tenantId: 'test-123' }))"
    Expected: Prints user object with tenantId='test-123'
    Evidence: .sisyphus/evidence/task-1-test-helpers.txt

  Scenario: Generate JWT token for tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. node -e "const { generateTestToken } = require('./src/test/utils/auth-helpers'); console.log(generateTestToken({ id: '1', username: 'test', role: 'ADMIN', tenantId: 't1' }))"
    Expected: Prints valid JWT string starting with "eyJ"
    Evidence: .sisyphus/evidence/task-1-jwt-token.txt
  ```

  **Commit**: YES | Message: `test: add test utilities and factories` | Files: `src/test/utils/`, `src/test/fixtures/`

- [ ] 2. Setup Test Database and Seeding

  **What to do**:
  - Create `.env.test` with test database URL (postgres://localhost:5432/crackpos_test)
  - Create `prisma/seed-test.ts` script to seed test database with sample data
  - Create `test/setup.ts` to run before all e2e tests (reset DB, seed data)
  - Update `test/jest-e2e.json` to use `.env.test` and run setup
  - Document test DB setup in `test/README.md`
  
  **Must NOT do**:
  - No connection to production database
  - No seed script that runs automatically on production
  - No test data with real user information

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Configuration and setup script
  - Skills: [`senior-devops`] - For environment setup
  - Omitted: [`senior-backend`] - Not needed for DB setup

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 28,29,30,31 | Blocked By: 1

  **References**:
  - Pattern: `test/app.e2e-spec.ts:1-50` - Existing e2e setup pattern
  - Pattern: `package.json:scripts` - Test scripts configuration
  - External: https://www.prisma.io/docs/guides/testing/integration-testing - Prisma test DB guide

  **Acceptance Criteria**:
  - [ ] `.env.test` exists with `DATABASE_URL=postgresql://localhost:5432/crackpos_test`
  - [ ] `prisma/seed-test.ts` creates 1 tenant, 2 users (ADMIN, STAFF), 5 products, 3 categories, 2 suppliers
  - [ ] `test/setup.ts` runs `prisma migrate reset --force` and `prisma db seed` before tests
  - [ ] `test/jest-e2e.json` has `setupFilesAfterEnv: ["<rootDir>/setup.ts"]`
  - [ ] `npm run test:e2e` uses test database (verified by checking connection string in logs)

  **QA Scenarios**:
  ```
  Scenario: Test database seeding
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. export DATABASE_URL="postgresql://localhost:5432/crackpos_test"
      3. npx prisma migrate reset --force --skip-seed
      4. npx ts-node prisma/seed-test.ts
      5. npx prisma studio --browser none & sleep 2 && curl http://localhost:5555
    Expected: Prisma Studio opens, database has 1 tenant, 2 users, 5 products
    Evidence: .sisyphus/evidence/task-2-seed-test.txt

  Scenario: E2E setup runs before tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm run test:e2e -- --testNamePattern="health" 2>&1 | grep -i "setup\|seed\|migrate"
    Expected: Logs show "Running setup", "Seeding test database"
    Evidence: .sisyphus/evidence/task-2-e2e-setup.txt
  ```

  **Commit**: YES | Message: `test: setup test database and seeding` | Files: `.env.test`, `prisma/seed-test.ts`, `test/setup.ts`, `test/jest-e2e.json`

- [ ] 3. Auth Service Unit Tests

  **What to do**:
  - Extend existing `src/auth/auth.service.spec.ts` to cover all methods
  - Test: `login()` - valid credentials, invalid password, user not found, locked account
  - Test: `register()` - success, duplicate username, validation errors
  - Test: `googleLogin()` - valid token, invalid token, new user creation
  - Test: `refreshToken()` - valid refresh, expired refresh, revoked token
  - Test: `logout()` - success, already logged out
  - Test: `createStore()` - platform user creates tenant, duplicate tenant slug
  - Mock: PrismaService, JwtService, UsersService, GoogleAuthLibrary
  
  **Must NOT do**:
  - No real database calls
  - No real Google OAuth API calls
  - No sleep/setTimeout in tests

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec, clear patterns
  - Skills: [`tdd-guide`] - For test structure
  - Omitted: [`senior-backend`] - Service already implemented

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 14 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-100` - Existing auth tests (login, mock setup)
  - Pattern: `src/auth/auth.service.ts` - All methods to test
  - API: `src/auth/dto/*.dto.ts` - Input validation DTOs

  **Acceptance Criteria**:
  - [ ] All 7 methods in AuthService have tests (login, register, googleLogin, refreshToken, logout, createStore, validateUser)
  - [ ] Each method has happy path + 2-3 error cases
  - [ ] Multi-tenant isolation tested (user from tenant A cannot access tenant B data)
  - [ ] Failed login attempts increment correctly (test account locking after 5 failures)
  - [ ] Refresh token rotation tested (old token invalidated after refresh)

  **QA Scenarios**:
  ```
  Scenario: Run auth service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- auth.service.spec.ts --coverage
    Expected: All tests pass, coverage >80% for auth.service.ts
    Evidence: .sisyphus/evidence/task-3-auth-service-tests.txt

  Scenario: Account locking after failed attempts
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- auth.service.spec.ts --testNamePattern="should lock account"
    Expected: Test passes, account locked after 5 failed attempts
    Evidence: .sisyphus/evidence/task-3-account-locking.txt
  ```

  **Commit**: YES | Message: `test(auth): complete auth service unit tests` | Files: `src/auth/auth.service.spec.ts`

- [ ] 4. Sales Service Unit Tests

  **What to do**:
  - Extend existing `src/sales/sales.service.spec.ts` to cover all methods
  - Test: `createSalesOrder()` - completed order, pending order, insufficient stock, COGS calculation
  - Test: `completePendingSalesOrder()` - success, order not found, already completed
  - Test: `getSalesOrders()` - list with tenantId filter, pagination, date range filter
  - Test: `getSalesOrderById()` - found, not found, wrong tenant
  - Test: `cancelSalesOrder()` - success, already completed, stock restoration
  - Mock: PrismaService with transaction support
  
  **Must NOT do**:
  - No real database transactions
  - No hardcoded product IDs (use fixtures)

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec
  - Skills: [`tdd-guide`] - For test patterns
  - Omitted: [`senior-backend`] - Service exists

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 15 | Blocked By: 1

  **References**:
  - Pattern: `src/sales/sales.service.spec.ts:1-150` - Existing sales tests (COGS, profit calculation)
  - Pattern: `src/sales/sales.service.ts` - All methods
  - Type: `src/sales/dto/*.dto.ts` - DTOs for validation

  **Acceptance Criteria**:
  - [ ] All 5 methods tested (create, complete, list, getById, cancel)
  - [ ] COGS calculation verified (totalCogs = sum of item.quantity * product.averageCost)
  - [ ] Profit calculation verified (totalProfit = totalPrice - totalCogs)
  - [ ] Stock deduction tested (product.stockQuantity decreases by order quantity)
  - [ ] Multi-tenant isolation (cannot access other tenant's orders)

  **QA Scenarios**:
  ```
  Scenario: Run sales service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- sales.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-4-sales-tests.txt
  ```

  **Commit**: YES | Message: `test(sales): complete sales service unit tests` | Files: `src/sales/sales.service.spec.ts`

- [ ] 5. Purchase Service Unit Tests

  **What to do**:
  - Extend existing `src/purchase/purchase.service.spec.ts`
  - Test: `createPurchaseOrder()` - pending order creation, validation
  - Test: `receivePurchaseOrder()` - receive goods, update stock, calculate average cost
  - Test: `getPurchaseOrders()` - list with filters, tenantId isolation
  - Test: `getPurchaseOrderById()` - found, not found, wrong tenant
  - Test: `cancelPurchaseOrder()` - success, already received
  - Test: `getSupplierSummary()` - total orders, total amount per supplier
  
  **Must NOT do**:
  - No real database calls
  - No external supplier API calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 16 | Blocked By: 1

  **References**:
  - Pattern: `src/purchase/purchase.service.spec.ts:1-100` - Existing purchase tests
  - Pattern: `src/purchase/purchase.service.ts` - All methods
  - Type: `src/purchase/dto/*.dto.ts` - DTOs

  **Acceptance Criteria**:
  - [ ] All 6 methods tested
  - [ ] Average cost calculation verified (weighted average after receiving goods)
  - [ ] Stock increment tested (product.stockQuantity increases)
  - [ ] Multi-tenant isolation verified

  **QA Scenarios**:
  ```
  Scenario: Run purchase service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- purchase.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-5-purchase-tests.txt
  ```

  **Commit**: YES | Message: `test(purchase): complete purchase service unit tests` | Files: `src/purchase/purchase.service.spec.ts`

- [ ] 6. Inventory Service Unit Tests

  **What to do**:
  - Extend existing `src/inventory/inventory.service.spec.ts`
  - Test: `adjustStock()` - increase, decrease, insufficient stock error
  - Test: `getLowStockProducts()` - products below reorder level
  - Test: `checkReorderLevel()` - product needs reorder, product OK
  - Test: `getStockTransactions()` - list with filters, tenantId isolation
  - Mock: PrismaService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 17 | Blocked By: 1

  **References**:
  - Pattern: `src/inventory/inventory.service.spec.ts:1-100` - Existing inventory tests
  - Pattern: `src/inventory/inventory.service.ts` - All methods

  **Acceptance Criteria**:
  - [ ] All 4 methods tested
  - [ ] Stock adjustment creates StockTransaction record
  - [ ] Low stock detection works (stockQuantity <= reorderLevel)
  - [ ] Multi-tenant isolation verified

  **QA Scenarios**:
  ```
  Scenario: Run inventory service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- inventory.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-6-inventory-tests.txt
  ```

  **Commit**: YES | Message: `test(inventory): complete inventory service unit tests` | Files: `src/inventory/inventory.service.spec.ts`

- [ ] 7. Returns Service Unit Tests

  **What to do**:
  - Extend existing `src/returns/returns.service.spec.ts`
  - Test: `createReturn()` - success, invalid sales order, stock restoration
  - Test: `getReturns()` - list with filters, tenantId isolation
  - Test: `getReturnById()` - found, not found, wrong tenant
  - Mock: PrismaService with transaction
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 18 | Blocked By: 1

  **References**:
  - Pattern: `src/returns/returns.service.spec.ts:1-100` - Existing returns tests
  - Pattern: `src/returns/returns.service.ts` - All methods

  **Acceptance Criteria**:
  - [ ] All 3 methods tested
  - [ ] Stock restoration verified (product.stockQuantity increases)
  - [ ] Return amount calculation correct
  - [ ] Multi-tenant isolation verified

  **QA Scenarios**:
  ```
  Scenario: Run returns service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- returns.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-7-returns-tests.txt
  ```

  **Commit**: YES | Message: `test(returns): complete returns service unit tests` | Files: `src/returns/returns.service.spec.ts`

- [ ] 8. Products Service Unit Tests

  **What to do**:
  - Create `src/products/products.service.spec.ts`
  - Test: `create()` - success, duplicate SKU, validation
  - Test: `findAll()` - list with filters, search, tenantId isolation
  - Test: `findOne()` - found, not found, wrong tenant
  - Test: `update()` - success, not found, duplicate SKU
  - Test: `remove()` - soft delete, not found
  - Mock: PrismaService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD service
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 19 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-50` - Mock setup pattern
  - Pattern: `src/products/products.service.ts` - All methods
  - Type: `src/products/dto/*.dto.ts` - DTOs

  **Acceptance Criteria**:
  - [ ] All 5 CRUD methods tested
  - [ ] Soft delete verified (deletedAt set, not physically deleted)
  - [ ] Multi-tenant isolation verified
  - [ ] Search functionality tested (name, SKU)

  **QA Scenarios**:
  ```
  Scenario: Run products service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- products.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-8-products-tests.txt
  ```

  **Commit**: YES | Message: `test(products): add products service unit tests` | Files: `src/products/products.service.spec.ts`

- [ ] 9. Categories Service Unit Tests

  **What to do**:
  - Create `src/categories/categories.service.spec.ts`
  - Test: `create()` - success, duplicate name
  - Test: `findAll()` - list, tenantId isolation
  - Test: `findOne()` - found, not found
  - Test: `update()` - success, not found
  - Test: `remove()` - soft delete, has products (should fail or cascade)
  - Mock: PrismaService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 20 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-50` - Mock pattern
  - Pattern: `src/categories/categories.service.ts` - Methods

  **Acceptance Criteria**:
  - [ ] All 5 CRUD methods tested
  - [ ] Soft delete verified
  - [ ] Multi-tenant isolation verified

  **QA Scenarios**:
  ```
  Scenario: Run categories service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- categories.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-9-categories-tests.txt
  ```

  **Commit**: YES | Message: `test(categories): add categories service unit tests` | Files: `src/categories/categories.service.spec.ts`

- [ ] 10. Suppliers Service Unit Tests

  **What to do**:
  - Create `src/suppliers/suppliers.service.spec.ts`
  - Test: `create()` - success, duplicate name
  - Test: `findAll()` - list, tenantId isolation
  - Test: `findOne()` - found, not found
  - Test: `update()` - success, not found
  - Test: `remove()` - soft delete
  - Mock: PrismaService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 21 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-50` - Mock pattern
  - Pattern: `src/suppliers/suppliers.service.ts` - Methods

  **Acceptance Criteria**:
  - [ ] All 5 CRUD methods tested
  - [ ] Soft delete verified
  - [ ] Multi-tenant isolation verified

  **QA Scenarios**:
  ```
  Scenario: Run suppliers service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- suppliers.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-10-suppliers-tests.txt
  ```

  **Commit**: YES | Message: `test(suppliers): add suppliers service unit tests` | Files: `src/suppliers/suppliers.service.spec.ts`

- [ ] 11. Users Service Unit Tests

  **What to do**:
  - Extend existing `src/users/users.service.spec.ts`
  - Test: `create()` - success, duplicate username, password hashing
  - Test: `findAll()` - list, tenantId isolation, role filter
  - Test: `findOne()` - found, not found
  - Test: `update()` - success, not found, cannot change tenantId
  - Test: `remove()` - soft delete
  - Test: `changePassword()` - success, wrong old password
  - Mock: PrismaService, bcrypt
  
  **Must NOT do**:
  - No real database calls
  - No plaintext passwords in tests

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Extending existing spec
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 22 | Blocked By: 1

  **References**:
  - Pattern: `src/users/users.service.spec.ts:1-100` - Existing users tests
  - Pattern: `src/users/users.service.ts` - Methods

  **Acceptance Criteria**:
  - [ ] All 6 methods tested
  - [ ] Password hashing verified (bcrypt.hash called)
  - [ ] Multi-tenant isolation verified
  - [ ] Cannot update user from different tenant

  **QA Scenarios**:
  ```
  Scenario: Run users service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- users.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-11-users-tests.txt
  ```

  **Commit**: YES | Message: `test(users): complete users service unit tests` | Files: `src/users/users.service.spec.ts`

- [ ] 12. Dashboard Service Unit Tests

  **What to do**:
  - Create `src/dashboard/dashboard.service.spec.ts`
  - Test: `getSummary()` - total sales, total products, low stock count, tenantId filter
  - Test: `getTopProducts()` - top 10 by sales quantity, tenantId filter
  - Test: `getSalesTrend()` - daily/weekly/monthly aggregation, date range
  - Test: `getInventoryValue()` - sum of (stockQuantity * averageCost), tenantId filter
  - Mock: PrismaService with aggregation queries
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Aggregation queries
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 23 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-50` - Mock pattern
  - Pattern: `src/dashboard/dashboard.service.ts` - Methods

  **Acceptance Criteria**:
  - [ ] All 4 methods tested
  - [ ] Aggregation calculations verified
  - [ ] Multi-tenant isolation verified
  - [ ] Date range filtering tested

  **QA Scenarios**:
  ```
  Scenario: Run dashboard service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- dashboard.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-12-dashboard-tests.txt
  ```

  **Commit**: YES | Message: `test(dashboard): add dashboard service unit tests` | Files: `src/dashboard/dashboard.service.spec.ts`

- [ ] 13. Reports Service Unit Tests

  **What to do**:
  - Create `src/reports/reports.service.spec.ts`
  - Test: `getSalesReport()` - date range, tenantId filter, CSV export
  - Test: `getInventoryReport()` - current stock levels, tenantId filter, CSV export
  - Test: `getProfitLossReport()` - revenue, COGS, profit calculation, date range
  - Mock: PrismaService
  
  **Must NOT do**:
  - No real database calls
  - No file system writes in unit tests

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Report generation
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 24 | Blocked By: 1

  **References**:
  - Pattern: `src/auth/auth.service.spec.ts:1-50` - Mock pattern
  - Pattern: `src/reports/reports.service.ts` - Methods

  **Acceptance Criteria**:
  - [ ] All 3 report methods tested
  - [ ] CSV generation tested (returns string with headers + rows)
  - [ ] Multi-tenant isolation verified
  - [ ] Date range filtering tested

  **QA Scenarios**:
  ```
  Scenario: Run reports service tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- reports.service.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-13-reports-tests.txt
  ```

  **Commit**: YES | Message: `test(reports): add reports service unit tests` | Files: `src/reports/reports.service.spec.ts`

- [ ] 14. Auth Controller Integration Tests

  **What to do**:
  - Create `src/auth/auth.controller.spec.ts`
  - Test all routes: POST /auth/register, POST /auth/login, POST /auth/google, POST /auth/create-store, POST /auth/refresh, POST /auth/logout, GET /auth/csrf-token
  - Test with real NestJS TestingModule (not mocked HTTP)
  - Test JWT guard bypass for public routes (@Public decorator)
  - Test validation errors (400), auth errors (401), forbidden (403)
  - Mock: PrismaService, AuthService (or use real service with mocked Prisma)
  
  **Must NOT do**:
  - No real database calls
  - No real Google OAuth

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Controller integration test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 28 | Blocked By: 1,3

  **References**:
  - Pattern: `test/app.e2e-spec.ts:50-100` - E2E controller test pattern (request, expect)
  - Pattern: `src/auth/auth.controller.ts` - All routes
  - External: https://docs.nestjs.com/fundamentals/testing#testing-request-scoped-instances

  **Acceptance Criteria**:
  - [ ] All 7 routes tested (register, login, google, create-store, refresh, logout, csrf-token)
  - [ ] Validation tested (missing fields return 400)
  - [ ] Auth tested (invalid credentials return 401)
  - [ ] Public routes accessible without JWT (csrf-token, login, register)
  - [ ] Protected routes require JWT (create-store)

  **QA Scenarios**:
  ```
  Scenario: Run auth controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- auth.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80% for auth.controller.ts
    Evidence: .sisyphus/evidence/task-14-auth-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(auth): add auth controller integration tests` | Files: `src/auth/auth.controller.spec.ts`

- [ ] 15. Sales Controller Integration Tests

  **What to do**:
  - Create `src/sales/sales.controller.spec.ts`
  - Test all routes: POST /sales, POST /sales/pending, PATCH /sales/:id/complete, GET /sales, GET /sales/:id, PATCH /sales/:id/cancel
  - Test JWT + Roles guards (ADMIN and STAFF can access)
  - Test tenantId isolation (cannot access other tenant's sales)
  - Mock: PrismaService, SalesService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Controller integration test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 29 | Blocked By: 1,4

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern with auth token
  - Pattern: `src/sales/sales.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 6 routes tested
  - [ ] JWT guard tested (401 without token)
  - [ ] Roles guard tested (ADMIN and STAFF both allowed)
  - [ ] Multi-tenant isolation tested (403 when accessing other tenant's data)

  **QA Scenarios**:
  ```
  Scenario: Run sales controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- sales.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-15-sales-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(sales): add sales controller integration tests` | Files: `src/sales/sales.controller.spec.ts`

- [ ] 16. Purchase Controller Integration Tests

  **What to do**:
  - Create `src/purchase/purchase.controller.spec.ts`
  - Test all routes: POST /purchase, POST /purchase/pending, PATCH /purchase/:id/receive, GET /purchase, GET /purchase/:id, GET /purchase/supplier-summary/:supplierId, PATCH /purchase/:id/cancel
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, PurchaseService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Controller integration test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 30 | Blocked By: 1,5

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/purchase/purchase.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 7 routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested

  **QA Scenarios**:
  ```
  Scenario: Run purchase controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- purchase.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-16-purchase-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(purchase): add purchase controller integration tests` | Files: `src/purchase/purchase.controller.spec.ts`

- [ ] 17. Inventory Controller Integration Tests

  **What to do**:
  - Create `src/inventory/inventory.controller.spec.ts`
  - Test all routes: POST /inventory/adjust, GET /inventory/low-stock, GET /inventory/check-reorder/:productId, POST /inventory/ai-input
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, InventoryService
  
  **Must NOT do**:
  - No real database calls
  - No real AI API calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Controller integration test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 31 | Blocked By: 1,6

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/inventory/inventory.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 4 routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested
  - [ ] AI input route mocked (no real AI API call)

  **QA Scenarios**:
  ```
  Scenario: Run inventory controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- inventory.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-17-inventory-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(inventory): add inventory controller integration tests` | Files: `src/inventory/inventory.controller.spec.ts`

- [ ] 18. Returns Controller Integration Tests

  **What to do**:
  - Create `src/returns/returns.controller.spec.ts`
  - Test all routes: POST /returns, GET /returns, GET /returns/:id
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, ReturnsService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Controller integration test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: - | Blocked By: 1,7

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/returns/returns.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 3 routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested

  **QA Scenarios**:
  ```
  Scenario: Run returns controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- returns.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-18-returns-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(returns): add returns controller integration tests` | Files: `src/returns/returns.controller.spec.ts`

- [ ] 19. Products Controller Integration Tests

  **What to do**:
  - Create `src/products/products.controller.spec.ts`
  - Test all routes: POST /products, GET /products, GET /products/:id, PATCH /products/:id, DELETE /products/:id
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, ProductsService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD controller
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,8

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/products/products.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 5 CRUD routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested
  - [ ] Soft delete verified (DELETE sets deletedAt)

  **QA Scenarios**:
  ```
  Scenario: Run products controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- products.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-19-products-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(products): add products controller integration tests` | Files: `src/products/products.controller.spec.ts`

- [ ] 20. Categories Controller Integration Tests

  **What to do**:
  - Create `src/categories/categories.controller.spec.ts`
  - Test all routes: POST /categories, GET /categories, GET /categories/:id, PATCH /categories/:id, DELETE /categories/:id
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, CategoriesService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD controller
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,9

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/categories/categories.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 5 CRUD routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested

  **QA Scenarios**:
  ```
  Scenario: Run categories controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- categories.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-20-categories-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(categories): add categories controller integration tests` | Files: `src/categories/categories.controller.spec.ts`

- [ ] 21. Suppliers Controller Integration Tests

  **What to do**:
  - Create `src/suppliers/suppliers.controller.spec.ts`
  - Test all routes: POST /suppliers, GET /suppliers, GET /suppliers/:id, PATCH /suppliers/:id, DELETE /suppliers/:id
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, SuppliersService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Standard CRUD controller
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,10

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/suppliers/suppliers.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 5 CRUD routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested

  **QA Scenarios**:
  ```
  Scenario: Run suppliers controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- suppliers.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-21-suppliers-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(suppliers): add suppliers controller integration tests` | Files: `src/suppliers/suppliers.controller.spec.ts`

- [ ] 22. Users Controller Integration Tests

  **What to do**:
  - Create `src/users/users.controller.spec.ts`
  - Test all routes: POST /users, GET /users, GET /users/:id, PATCH /users/:id, DELETE /users/:id, PATCH /users/:id/change-password
  - Test JWT + Roles guards (ADMIN only for create/delete, both for read)
  - Test tenantId isolation
  - Mock: PrismaService, UsersService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: CRUD with role restrictions
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,11

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/users/users.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 6 routes tested
  - [ ] Role-based access tested (ADMIN can create/delete, STAFF cannot)
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested

  **QA Scenarios**:
  ```
  Scenario: Run users controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- users.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-22-users-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(users): add users controller integration tests` | Files: `src/users/users.controller.spec.ts`

- [ ] 23. Dashboard Controller Integration Tests

  **What to do**:
  - Create `src/dashboard/dashboard.controller.spec.ts`
  - Test all routes: GET /dashboard/summary, GET /dashboard/top-products, GET /dashboard/sales-trend, GET /dashboard/inventory-value
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Mock: PrismaService, DashboardService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Read-only dashboard routes
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,12

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/dashboard/dashboard.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 4 routes tested
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested
  - [ ] Aggregation data format verified

  **QA Scenarios**:
  ```
  Scenario: Run dashboard controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- dashboard.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-23-dashboard-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(dashboard): add dashboard controller integration tests` | Files: `src/dashboard/dashboard.controller.spec.ts`

- [ ] 24. Reports Controller Integration Tests

  **What to do**:
  - Create `src/reports/reports.controller.spec.ts`
  - Test all routes: GET /reports/sales, GET /reports/inventory, GET /reports/profit-loss, GET /reports/sales/csv, GET /reports/inventory/csv, GET /reports/profit-loss/csv
  - Test JWT + Roles guards
  - Test tenantId isolation
  - Test CSV content-type headers
  - Mock: PrismaService, ReportsService
  
  **Must NOT do**:
  - No real database calls

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Report routes
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1,13

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/reports/reports.controller.ts` - All routes

  **Acceptance Criteria**:
  - [ ] All 6 routes tested (3 JSON + 3 CSV)
  - [ ] JWT + Roles guards tested
  - [ ] Multi-tenant isolation tested
  - [ ] CSV routes return text/csv content-type

  **QA Scenarios**:
  ```
  Scenario: Run reports controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- reports.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-24-reports-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(reports): add reports controller integration tests` | Files: `src/reports/reports.controller.spec.ts`

- [ ] 25. Upload Controller Integration Tests

  **What to do**:
  - Create `src/upload/upload.controller.spec.ts`
  - Test route: POST /upload/image
  - Test JWT + Roles guards
  - Test file upload (multipart/form-data)
  - Test file validation (size, type)
  - Mock: File storage (no real file writes)
  
  **Must NOT do**:
  - No real file system writes

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: File upload route
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: - | Blocked By: 1

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/upload/upload.controller.ts` - Route
  - External: https://docs.nestjs.com/techniques/file-upload#testing

  **Acceptance Criteria**:
  - [ ] POST /upload/image tested
  - [ ] JWT + Roles guards tested
  - [ ] File validation tested (reject non-image files)
  - [ ] File size limit tested (reject files >5MB)

  **QA Scenarios**:
  ```
  Scenario: Run upload controller tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- upload.controller.spec.ts --coverage
    Expected: All tests pass, coverage >80%
    Evidence: .sisyphus/evidence/task-25-upload-controller-tests.txt
  ```

  **Commit**: YES | Message: `test(upload): add upload controller integration tests` | Files: `src/upload/upload.controller.spec.ts`

- [ ] 26. Guards and Middleware Tests

  **What to do**:
  - Create `src/common/guards/roles.guard.spec.ts` - test ADMIN/STAFF role enforcement
  - Create `src/common/guards/tenant-throttler.guard.spec.ts` - test per-user rate limiting
  - Create `src/common/guards/csrf.guard.spec.ts` - test CSRF token validation
  - Create `src/common/guards/platform-jwt.guard.spec.ts` - test platform admin JWT
  - Create `src/common/middleware/sanitize.middleware.spec.ts` - test input sanitization
  - All guards must test: canActivate() returns true/false, ExecutionContext mocking
  
  **Must NOT do**:
  - No real HTTP requests

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Guard/middleware unit tests
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: 28,29,30,31 | Blocked By: 1

  **References**:
  - Pattern: `src/common/guards/jwt-auth.guard.spec.ts:1-50` - Existing guard test pattern
  - Pattern: `src/common/guards/roles.guard.ts` - RolesGuard implementation
  - Pattern: `src/common/guards/tenant-throttler.guard.ts` - TenantThrottlerGuard implementation

  **Acceptance Criteria**:
  - [ ] RolesGuard: ADMIN allowed, STAFF blocked for ADMIN-only routes
  - [ ] TenantThrottlerGuard: per-user rate limit enforced (300 req/min)
  - [ ] CsrfGuard: valid token passes, invalid token blocks
  - [ ] PlatformJwtGuard: platform admin JWT validated
  - [ ] SanitizeMiddleware: XSS payloads sanitized

  **QA Scenarios**:
  ```
  Scenario: Run guards and middleware tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- --testPathPattern="guards|middleware" --coverage
    Expected: All tests pass, coverage >80% for guards and middleware
    Evidence: .sisyphus/evidence/task-26-guards-middleware-tests.txt
  ```

  **Commit**: YES | Message: `test(common): add guards and middleware tests` | Files: `src/common/guards/*.spec.ts`, `src/common/middleware/*.spec.ts`

- [ ] 27. Interceptors Tests

  **What to do**:
  - Create `src/common/interceptors/response.interceptor.spec.ts` - test response wrapping ({ success, data, message })
  - Create `src/common/interceptors/audit-log.interceptor.spec.ts` - test activity logging
  - Create `src/common/interceptors/cache.interceptor.spec.ts` - test caching behavior
  - All interceptors must test: intercept() method, Observable handling
  
  **Must NOT do**:
  - No real database calls for audit log

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Interceptor unit tests
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: 28,29,30,31 | Blocked By: 1

  **References**:
  - Pattern: `src/common/guards/jwt-auth.guard.spec.ts:1-50` - Mock ExecutionContext pattern
  - Pattern: `src/common/interceptors/response.interceptor.ts` - ResponseInterceptor implementation
  - External: https://docs.nestjs.com/interceptors#testing

  **Acceptance Criteria**:
  - [ ] ResponseInterceptor: wraps data in { success: true, data, message }
  - [ ] AuditLogInterceptor: creates ActivityLog record after request
  - [ ] CacheInterceptor: returns cached response on second call

  **QA Scenarios**:
  ```
  Scenario: Run interceptors tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm test -- --testPathPattern="interceptors" --coverage
    Expected: All tests pass, coverage >80% for interceptors
    Evidence: .sisyphus/evidence/task-27-interceptors-tests.txt
  ```

  **Commit**: YES | Message: `test(common): add interceptors tests` | Files: `src/common/interceptors/*.spec.ts`

- [ ] 28. E2E Auth Flow Tests

  **What to do**:
  - Extend `test/app.e2e-spec.ts` with comprehensive auth flow tests
  - Test: Register → Login → Access protected route → Refresh token → Logout
  - Test: Google OAuth flow (mocked)
  - Test: Create store flow (platform user creates tenant)
  - Test: Failed login attempts → Account locking
  - Test: Expired JWT → 401 error
  - Use real test database (seeded by setup.ts)
  
  **Must NOT do**:
  - No production database
  - No real Google OAuth API

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: E2E flow test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: - | Blocked By: 1,2,14,26,27

  **References**:
  - Pattern: `test/app.e2e-spec.ts:50-150` - Existing e2e auth tests
  - Pattern: `src/auth/auth.controller.ts` - Auth routes

  **Acceptance Criteria**:
  - [ ] Full auth flow tested (register → login → protected route → refresh → logout)
  - [ ] Account locking tested (5 failed attempts → locked for 15 minutes)
  - [ ] Expired JWT tested (401 error)
  - [ ] Google OAuth flow tested (mocked)
  - [ ] Create store flow tested (platform user creates tenant)

  **QA Scenarios**:
  ```
  Scenario: Run e2e auth flow tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm run test:e2e -- --testNamePattern="Auth flow"
    Expected: All auth flow tests pass
    Evidence: .sisyphus/evidence/task-28-e2e-auth-flow.txt
  ```

  **Commit**: YES | Message: `test(e2e): add comprehensive auth flow tests` | Files: `test/app.e2e-spec.ts`

- [ ] 29. E2E Sales Flow Tests

  **What to do**:
  - Create `test/sales-flow.e2e-spec.ts`
  - Test: Login as STAFF → Create pending sales order → Complete order → Verify stock deduction → Verify COGS/profit calculation
  - Test: Create completed sales order (direct checkout)
  - Test: Cancel sales order → Verify stock restoration
  - Test: List sales orders → Verify tenantId isolation
  - Use real test database
  
  **Must NOT do**:
  - No production database

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: E2E flow test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: - | Blocked By: 1,2,15,26,27

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern with auth
  - Pattern: `src/sales/sales.controller.ts` - Sales routes

  **Acceptance Criteria**:
  - [ ] Full sales flow tested (pending → complete → stock deduction)
  - [ ] COGS calculation verified in e2e (matches expected value)
  - [ ] Profit calculation verified in e2e
  - [ ] Cancel order restores stock
  - [ ] Multi-tenant isolation verified (cannot access other tenant's orders)

  **QA Scenarios**:
  ```
  Scenario: Run e2e sales flow tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm run test:e2e -- sales-flow.e2e-spec.ts
    Expected: All sales flow tests pass
    Evidence: .sisyphus/evidence/task-29-e2e-sales-flow.txt
  ```

  **Commit**: YES | Message: `test(e2e): add sales flow tests` | Files: `test/sales-flow.e2e-spec.ts`

- [ ] 30. E2E Purchase Flow Tests

  **What to do**:
  - Create `test/purchase-flow.e2e-spec.ts`
  - Test: Login as ADMIN → Create pending purchase order → Receive goods → Verify stock increment → Verify average cost update
  - Test: Cancel purchase order
  - Test: Get supplier summary
  - Use real test database
  
  **Must NOT do**:
  - No production database

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: E2E flow test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: - | Blocked By: 1,2,16,26,27

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/purchase/purchase.controller.ts` - Purchase routes

  **Acceptance Criteria**:
  - [ ] Full purchase flow tested (pending → receive → stock increment)
  - [ ] Average cost calculation verified (weighted average)
  - [ ] Cancel order tested
  - [ ] Supplier summary tested (total orders, total amount)

  **QA Scenarios**:
  ```
  Scenario: Run e2e purchase flow tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm run test:e2e -- purchase-flow.e2e-spec.ts
    Expected: All purchase flow tests pass
    Evidence: .sisyphus/evidence/task-30-e2e-purchase-flow.txt
  ```

  **Commit**: YES | Message: `test(e2e): add purchase flow tests` | Files: `test/purchase-flow.e2e-spec.ts`

- [ ] 31. E2E Inventory Flow Tests

  **What to do**:
  - Create `test/inventory-flow.e2e-spec.ts`
  - Test: Login as ADMIN → Adjust stock (increase) → Verify stock transaction created
  - Test: Adjust stock (decrease) → Verify insufficient stock error
  - Test: Get low stock products → Verify reorder level detection
  - Test: Check reorder level for specific product
  - Use real test database
  
  **Must NOT do**:
  - No production database

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: E2E flow test
  - Skills: [`tdd-guide`]
  - Omitted: [`senior-backend`]

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: - | Blocked By: 1,2,17,26,27

  **References**:
  - Pattern: `test/app.e2e-spec.ts:100-200` - E2E pattern
  - Pattern: `src/inventory/inventory.controller.ts` - Inventory routes

  **Acceptance Criteria**:
  - [ ] Stock adjustment tested (increase and decrease)
  - [ ] Insufficient stock error tested
  - [ ] Low stock detection tested
  - [ ] Reorder level check tested

  **QA Scenarios**:
  ```
  Scenario: Run e2e inventory flow tests
    Tool: Bash
    Steps:
      1. cd /home/satria/Final-project-crack/crack-be/crack-be-yogaaaa123
      2. npm run test:e2e -- inventory-flow.e2e-spec.ts
    Expected: All inventory flow tests pass
    Evidence: .sisyphus/evidence/task-31-e2e-inventory-flow.txt
  ```

  **Commit**: YES | Message: `test(e2e): add inventory flow tests` | Files: `test/inventory-flow.e2e-spec.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
  - Verify all 31 tasks completed
  - Verify all test files created
  - Verify coverage >80% for all modules
  - Verify no skipped tests

- [ ] F2. Code Quality Review — unspecified-high
  - Review test code quality (no AI slop patterns)
  - Verify test naming conventions
  - Verify no hardcoded credentials
  - Verify proper mocking (no real DB/API calls in unit tests)

- [ ] F3. Real Manual QA — unspecified-high
  - Run `npm test` and verify all pass
  - Run `npm run test:e2e` and verify all pass
  - Run `npm run test:cov` and verify coverage >80%
  - Verify test database setup works

- [ ] F4. Scope Fidelity Check — deep
  - Verify multi-tenant isolation tested
  - Verify JWT auth tested
  - Verify role-based access tested
  - Verify all critical flows covered (auth, sales, purchase, inventory)

## Commit Strategy
- Each task commits its own test files
- Commit messages follow pattern: `test(module): description`
- All commits pushed to feature branch `test/comprehensive-suite`
- Final PR created after F1-F4 approval

## Success Criteria
- [ ] All 31 tasks completed
- [ ] `npm test` passes with 80%+ coverage
- [ ] `npm run test:e2e` passes all flows
- [ ] Multi-tenant isolation verified (no cross-tenant data leaks)
- [ ] JWT auth and role-based access verified
- [ ] All critical business flows tested (auth, sales, purchase, inventory)
- [ ] Test database setup documented and working
- [ ] CI-ready (can run in GitHub Actions)

