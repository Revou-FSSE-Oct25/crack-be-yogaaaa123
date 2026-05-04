import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Gunakan Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // ═══════════════════════════════════════════════════════════════════
  // ENVIRONMENT VALIDATION — fail fast, fail loud
  // ═══════════════════════════════════════════════════════════════════
  const requiredVars: { name: string; value: string | undefined; weakDefaults: string[] }[] = [
    {
      name: 'JWT_SECRET',
      value: process.env.JWT_SECRET,
      weakDefaults: ['super-secret-dont-share-123', 'secret', 'changeme', ''],
    },
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL, weakDefaults: [''] },
    { name: 'AI_INTERNAL_API_KEY', value: process.env.AI_INTERNAL_API_KEY, weakDefaults: [''] },
  ];

  let hasError = false;
  for (const v of requiredVars) {
    if (!v.value || v.weakDefaults.includes(v.value)) {
      logger.error(`❌ ${v.name} environment variable is not set or using an unsafe default!`);
      hasError = true;
    }
  }
  if (hasError) {
    logger.error('❌ Application startup aborted due to missing or unsafe environment variables.');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELMET — security headers (XSS, clickjacking, MIME sniffing, etc.)
  // ═══════════════════════════════════════════════════════════════════
  app.use(helmet());

  // ═══════════════════════════════════════════════════════════════════
  // CORS
  // ═══════════════════════════════════════════════════════════════════
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
    credentials: true,
  });

  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL FILTERS (order matters: specific → generic)
  // ═══════════════════════════════════════════════════════════════════
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new PrismaClientExceptionFilter(httpAdapter), // Specific: Prisma errors
    new HttpExceptionFilter(), // HTTP exceptions (401, 403, 404, etc.)
    new AllExceptionsFilter(), // Fallback: any unhandled error
  );

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL INTERCEPTORS
  // ═══════════════════════════════════════════════════════════════════
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ═══════════════════════════════════════════════════════════════════
  // SWAGGER
  // ═══════════════════════════════════════════════════════════════════
  const config = new DocumentBuilder()
    .setTitle('CrackPOS Inventory API')
    .setDescription('Enterprise Inventory Management API')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ═══════════════════════════════════════════════════════════════════
  // SERVE
  // ═══════════════════════════════════════════════════════════════════
  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api`);
  logger.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  logger.log(`Health check: http://localhost:${port}/health`);
}
void bootstrap();
