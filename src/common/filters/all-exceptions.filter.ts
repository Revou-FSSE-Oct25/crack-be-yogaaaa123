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

    // If it's an HttpException, use its status and message instead of generic 500
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || exception.message;

      this.logger.warn(`HTTP ${status}: ${JSON.stringify(message)}`);

      response.status(status).json({
        statusCode: status,
        message,
        error: exception.name,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = 'An unexpected error occurred. Please try again later.';

    this.logger.error(
      `Unhandled Exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }
}
