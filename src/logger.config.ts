import { utilities as nestWinstonUtilities } from 'nest-winston';
import { format, transports, LoggerOptions } from 'winston';

/**
 * Winston Logger Configuration for CrackPOS Backend.
 *
 * Returns WinstonModuleOptions (LoggerOptions), NOT a LoggerService instance.
 * This allows it to be used with WinstonModule.forRoot() or WinstonModule.forRootAsync().
 *
 * Provides structured JSON logging in production and
 * colorful human-readable logging in development.
 *
 * FEATURES:
 * - Production: JSON format → easier for log aggregators (ELK, Datadog, etc.)
 * - Development: Colorful console output with timestamp
 * - All logs include: timestamp, level, context (class name), message
 * - Error logs include full stack trace
 */
export function createWinstonLoggerOptions(): LoggerOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    format: isProduction
      ? // Production: JSON for log aggregation
        format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.ms(),
          format.errors({ stack: true }),
          format.json(),
        )
      : // Development: colorful human-readable
        format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.ms(),
          format.errors({ stack: true }),
          nestWinstonUtilities.format.nestLike('CrackPOS', {
            colors: true,
            prettyPrint: true,
          }),
        ),
    transports: [
      new transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
  };
}
