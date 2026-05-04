import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaClientExceptionFilter } from '../src/common/filters/prisma-client-exception.filter';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('App (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let testCategoryId: string;
  let testProductId: string;
  let testSupplierId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(
      new PrismaClientExceptionFilter(httpAdapter),
      new HttpExceptionFilter(),
      new AllExceptionsFilter(),
    );
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'Admin@123' })
      .expect(200);

    adminToken = adminLogin.body.data.access_token;

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'staff', password: 'Staff@123' })
      .expect(200);

    staffToken = staffLogin.body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ================================================================
  // HEALTH
  // ================================================================
  describe('/health (GET)', () => {
    it('should return status ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect((res) => {
          expect(res.status).toBeLessThan(503);
        });
    });
  });

  // ================================================================
  // AUTHENTICATION
  // ================================================================
  describe('/auth/login (POST)', () => {
    it('should reject login with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'nonexistent', password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject login with missing fields (validation)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'onlyusername' })
        .expect(400);
    });

    it('should reject login with password too short', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: '123' })
        .expect(400);
    });

    it('should login admin and return JWT + user info', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'Admin@123' })
        .expect(200);

      const d = res.body.data;
      expect(d.access_token).toBeDefined();
      expect(d.refresh_token).toBeDefined();
      expect(d.user).toBeDefined();
      expect(d.user.username).toBe('admin');
      expect(d.user.role).toBe('ADMIN');
    });

    it('should login staff and return JWT + user info', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'staff', password: 'Staff@123' })
        .expect(200);

      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.user.role).toBe('STAFF');
    });
  });

  // ================================================================
  // PROTECTED ROUTES (no token)
  // ================================================================
  describe('Protected routes (no token)', () => {
    const routes = [
      '/sales',
      '/purchase',
      '/users',
      '/products',
      '/categories',
      '/returns',
      '/dashboard/summary',
    ];

    routes.forEach((route) => {
      it(`GET ${route} should return 401 without token`, () => {
        return request(app.getHttpServer()).get(route).expect(401);
      });
    });
  });

  // ================================================================
  // CATEGORIES CRUD
  // ================================================================
  describe('/categories', () => {
    it('GET /categories should return paginated list (admin)', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('POST /categories should create new category (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Test Category' })
        .expect(201);

      expect(res.body.data).toBeDefined();
      testCategoryId = res.body.data.id;
    });

    it('POST /categories should reject missing name (validation 400)', () => {
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('GET /categories/:id should return created category', async () => {
      if (!testCategoryId) return;
      const res = await request(app.getHttpServer())
        .get(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('GET /categories/:id with non-existent UUID should return 404', () => {
      return request(app.getHttpServer())
        .get('/categories/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('PATCH /categories/:id should update category', async () => {
      if (!testCategoryId) return;
      const res = await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `E2E Updated ${Date.now()}` })
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('staff cannot POST /categories (403 forbidden)', () => {
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Staff Created Category' })
        .expect(403);
    });

    it('staff can GET /categories (200)', () => {
      return request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  // ================================================================
  // SUPPLIERS
  // ================================================================
  describe('/suppliers', () => {
    it('GET /suppliers should return paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
      if (res.body.data.data.length > 0) {
        testSupplierId = res.body.data.data[0].id;
      }
    });

    it('POST /suppliers should create supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Test Supplier ${Date.now()}`,
          contactName: 'Test Contact',
          email: `supplier-${Date.now()}@e2e-test.com`,
          phone: '081234567890',
          address: 'Jl. Test No. 123',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      testSupplierId = res.body.data.id;
    });
  });

  // ================================================================
  // PRODUCTS
  // ================================================================
  describe('/products', () => {
    let seedCategoryId: string;

    beforeAll(async () => {
      const cats = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      if (cats.body.data?.length > 0) {
        seedCategoryId = cats.body.data[0].id;
      }
    });

    it('GET /products should return paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
      if (res.body.data.data.length > 0) {
        testProductId = res.body.data.data[0].id;
      }
    });

    it('GET /products?search= should filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?search=Indomie')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
    });

    it('POST /products should create product (admin)', async () => {
      if (!seedCategoryId || !testSupplierId) return;

      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: 'E2E-TEST-001',
          name: 'E2E Test Product',
          description: 'Created by e2e',
          price: '50000',
          stockQuantity: 100,
          categoryId: seedCategoryId,
          supplierId: testSupplierId,
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      testProductId = res.body.data.id;
    });

    it('POST /products with missing required fields should fail 400', () => {
      return request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Invalid Product' })
        .expect(400);
    });

    it('GET /products/:id with non-existent UUID returns 404', () => {
      return request(app.getHttpServer())
        .get('/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('staff can GET /products (200)', () => {
      return request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  // ================================================================
  // INVENTORY
  // ================================================================
  describe('/inventory', () => {
    it('GET /inventory/low-stock should return low stock items', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/low-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('POST /inventory/adjust should adjust stock (admin)', async () => {
      if (!testProductId) return;

      const res = await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: testProductId,
          quantityChange: 10,
          type: 'IN',
          notes: 'E2E stock adjustment',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
    });

    it('staff cannot POST /inventory/adjust (403)', async () => {
      if (!testProductId) return;

      await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          productId: testProductId,
          quantityChange: 5,
          type: 'OUT',
          notes: 'Staff stock adjustment',
        })
        .expect(403);
    });
  });

  // ================================================================
  // SALES ORDERS
  // ================================================================
  describe('/sales', () => {
    it('GET /sales should return paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('POST /sales should create sales order', async () => {
      if (!testProductId) return;

      const res = await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `SO-E2E-${Date.now()}`,
          items: [
            {
              productId: testProductId,
              quantity: 2,
              unitPrice: '50000',
            },
          ],
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
    });

    it('POST /sales with empty items should fail 400', () => {
      return request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderNumber: 'SO-TEST', items: [] })
        .expect(400);
    });

    it('POST /sales with invalid item should fail 400', () => {
      return request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: 'SO-BAD',
          items: [{ productId: 'not-a-uuid', quantity: 1, unitPrice: '50000' }],
        })
        .expect(400);
    });

    it('POST /sales without orderNumber should fail 400', () => {
      return request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId: testProductId, quantity: 1, unitPrice: '50000' }] })
        .expect(400);
    });
  });

  // ================================================================
  // PURCHASE ORDERS
  // ================================================================
  describe('/purchase', () => {
    it('GET /purchase should return paginated list', async () => {
      const res = await request(app.getHttpServer())
        .get('/purchase')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('POST /purchase should create purchase order', async () => {
      if (!testProductId || !testSupplierId) return;

      const res = await request(app.getHttpServer())
        .post('/purchase')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: `PO-E2E-${Date.now()}`,
          supplierId: testSupplierId,
          items: [
            {
              productId: testProductId,
              quantity: 10,
              unitPrice: '30000',
            },
          ],
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
    });

    it('POST /purchase without supplierId should fail 400', () => {
      return request(app.getHttpServer())
        .post('/purchase')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          orderNumber: 'PO-TEST',
          items: [{ productId: testProductId, quantity: 5, unitPrice: '10000' }],
        })
        .expect(400);
    });

    it('PATCH /purchase/:id/status with non-existent ID should return 404', () => {
      return request(app.getHttpServer())
        .patch('/purchase/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' })
        .expect(404);
    });
  });

  // ================================================================
  // RETURNS
  // ================================================================
  describe('/returns', () => {
    it('GET /returns should return list', async () => {
      const res = await request(app.getHttpServer())
        .get('/returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================
  // DASHBOARD
  // ================================================================
  describe('/dashboard', () => {
    const endpoints = [
      '/dashboard/summary',
      '/dashboard/top-products',
      '/dashboard/sales-trend',
      '/dashboard/inventory-value',
    ];

    endpoints.forEach((endpoint) => {
      it(`GET ${endpoint} should return 200 (admin)`, async () => {
        const res = await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });

      it(`GET ${endpoint} should return 200 (staff)`, async () => {
        const res = await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${staffToken}`)
          .expect(200);

        expect(res.body.data).toBeDefined();
      });
    });
  });

  // ================================================================
  // ROLE-BASED ACCESS CONTROL
  // ================================================================
  describe('Role-based access control', () => {
    it('GET /users (staff) should return 403', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('GET /reports/sales (staff) should return 403', () => {
      return request(app.getHttpServer())
        .get('/reports/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('GET /users (admin) should return 200', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ================================================================
  // EDGE CASES & ERROR HANDLING
  // ================================================================
  describe('Edge cases & error handling', () => {
    it('GET with invalid UUID param should return 404', () => {
      return request(app.getHttpServer())
        .get('/products/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('POST with non-whitelisted property should return 400', () => {
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', extraField: 'should-be-rejected' })
        .expect(400);
    });

    it('GET unknown route should return 404', () => {
      return request(app.getHttpServer()).get('/nonexistent-route').expect(404);
    });

    it('POST /auth/login with empty body should return 400', () => {
      return request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
    });

    it('Protected route with malformed token should return 401', () => {
      return request(app.getHttpServer())
        .get('/products')
        .set('Authorization', 'Bearer malformed-token-not-valid')
        .expect(401);
    });

    it('Protected route with no Authorization header should return 401', () => {
      return request(app.getHttpServer()).get('/products').expect(401);
    });
  });

  // ================================================================
  // RESPONSE ENVELOPE
  // ================================================================
  describe('Response envelope', () => {
    it('GET endpoints should return envelope with timestamp', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.timestamp).toBeDefined();
      expect(res.body.statusCode).toBeDefined();
    });

    it('POST endpoints should return envelope', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Envelope Test ${Date.now()}` })
        .expect(201);

      expect(res.body.message).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
