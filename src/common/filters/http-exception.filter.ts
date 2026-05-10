import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || exception.message,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'production') {
      errorResponse.error = exception.name;
    }

    if (status >= 500) {
      this.logger.error(
        `HTTP ${status}: ${JSON.stringify(errorResponse.message)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`HTTP ${status}: ${JSON.stringify(errorResponse.message)}`);
    }

    response.status(status).json(errorResponse);
  }
}
