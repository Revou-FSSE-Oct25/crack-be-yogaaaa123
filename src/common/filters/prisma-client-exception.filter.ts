import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const message = exception.message.replace(/\n/g, '');

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        response.status(status).json({
          statusCode: status,
          message: 'Data conflicts with existing records (Unique Constraint Violation)',
          error: 'Conflict',
        });
        break;
      }
      case 'P2003': {
        const status = HttpStatus.BAD_REQUEST;
        response.status(status).json({
          statusCode: status,
          message:
            'Referenced record not found (Foreign Key Constraint Violation). ' +
            'Check that the related record exists before performing this action.',
          error: 'Bad Request',
          prismaCode: 'P2003',
        });
        break;
      }
      case 'P2011': {
        const status = HttpStatus.BAD_REQUEST;
        response.status(status).json({
          statusCode: status,
          message:
            'A required field is missing (Null Constraint Violation). ' +
            'Ensure all required fields are provided.',
          error: 'Bad Request',
          prismaCode: 'P2011',
        });
        break;
      }
      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;
        response.status(status).json({
          statusCode: status,
          message: 'Requested record was not found',
          error: 'Not Found',
        });
        break;
      }
      default:
        this.logger.error(
          `Unhandled Prisma Error: ${exception.code} - ${message}`,
          exception.stack,
        );
        super.catch(exception, host);
        break;
    }
  }
}
