import { utilities as nestWinstonUtilities } from 'nest-winston';
import { format, transports, LoggerOptions } from 'winston';

export function createWinstonLoggerOptions(): LoggerOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    format: isProduction
      ? format.combine(
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.ms(),
          format.errors({ stack: true }),
          format.json(),
        )
      : format.combine(
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
