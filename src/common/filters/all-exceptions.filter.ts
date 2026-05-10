import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || exception.message;

      this.logger.warn(`HTTP ${status}: ${JSON.stringify(message)}`);

      const body: Record<string, unknown> = {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      };
      if (process.env.NODE_ENV !== 'production') {
        body.error = exception.name;
      }

      response.status(status).json(body);
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = 'An unexpected error occurred. Please try again later.';

    this.logger.error(
      `Unhandled Exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== 'production') {
      body.error = 'Internal Server Error';
    }

    response.status(status).json(body);
  }
}
