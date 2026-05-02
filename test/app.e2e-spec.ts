import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return status ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect((res) => {
          expect(res.status).toBeLessThan(503);
          expect(res.body.status).toBeDefined();
        });
    });
  });

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
        .send({ username: 'onlyusername' }) // missing password
        .expect(400);
    });

    it('should reject login with password too short', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin1', password: '123' }) // MinLength(6) fails
        .expect(400);
    });
  });

  describe('Protected routes (no token)', () => {
    it('GET /sales should return 401 without token', () => {
      return request(app.getHttpServer()).get('/sales').expect(401);
    });

    it('GET /purchase should return 401 without token', () => {
      return request(app.getHttpServer()).get('/purchase').expect(401);
    });

    it('GET /users should return 401 without token', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });

    it('GET /inventory/low-stock should return 401 without token', () => {
      return request(app.getHttpServer()).get('/inventory/low-stock').expect(401);
    });
  });
});
