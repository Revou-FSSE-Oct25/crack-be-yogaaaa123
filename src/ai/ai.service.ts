import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiBaseUrl: string;
  private readonly internalApiKey: string;

  constructor(private readonly httpService: HttpService) {
    this.aiBaseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.internalApiKey = process.env.AI_INTERNAL_API_KEY || '';
  }

  /**
   * Send a chat message to the Python AI service (/chat endpoint)
   * Uses internal API key + forwarded JWT for authentication.
   *
   * @param message - User's chat message
   * @param history - Chat history (optional)
   * @param token - Raw JWT token to forward to Python AI service
   * @param user - Authenticated user info (for logging / audit)
   */
  async chat(
    message: string,
    history: any[],
    token: string,
    user?: AuthenticatedUser,
  ): Promise<any> {
    const url = `${this.aiBaseUrl}/chat`;

    // Transform history from FE format ({role, content}) to Python AI format ({role, parts: [string]})
    const transformedHistory = (history || []).map((msg: any) => {
      if (msg.parts) {
        // Already in correct format
        return msg;
      }
      return {
        role: msg.role,
        parts: [msg.content || msg.text || ''],
      };
    });

    this.logger.log(`Proxying chat to AI service [user=${user?.username || 'unknown'}]: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { message, history: transformedHistory },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-API-Key': this.internalApiKey,
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `AI service error [user=${user?.username || 'unknown'}]: ${error.message}`,
        error.response?.data || error.stack,
      );

      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;

        if (statusCode === HttpStatus.UNAUTHORIZED) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_GATEWAY,
              message: 'AI service authentication failed',
              detail: errorData?.detail || 'Invalid or missing credentials to AI service',
            },
            HttpStatus.BAD_GATEWAY,
          );
        }

        throw new HttpException(
          {
            statusCode,
            message: errorData?.detail || errorData?.message || 'AI service error',
            data: errorData,
          },
          statusCode >= 100 && statusCode < 600 ? statusCode : HttpStatus.BAD_GATEWAY,
        );
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'AI service is unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
