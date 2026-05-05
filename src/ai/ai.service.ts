import { Injectable, Logger, HttpException, HttpStatus, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

interface ChatHistoryMessage {
  role?: string;
  parts?: string[];
  content?: string;
  text?: string;
}

export interface AiChatResponse {
  reply: string;
  toolsUsed: string[];
  [key: string]: unknown;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiBaseUrl: string;
  private readonly internalApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
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
    history: ChatHistoryMessage[],
    token: string,
    user?: AuthenticatedUser,
  ): Promise<AiChatResponse> {
    // ── CEK TOKEN AI (per toko/tenant) ────────────────────────────
    if (user && !user.isSuperAdmin) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { aiTokens: true, aiTokensUsed: true },
      });

      if (!tenant || tenant.aiTokens - tenant.aiTokensUsed <= 0) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: 'Token AI toko habis. Hubungi admin untuk menambah token.',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const url = `${this.aiBaseUrl}/chat`;

    // Transform history from FE format ({role, content}) to Python AI format ({role, parts: [string]})
    const transformedHistory = (history || []).map((msg: ChatHistoryMessage) => {
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
        this.httpService.post<AiChatResponse>(
          url,
          { message, history: transformedHistory },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-API-Key': this.internalApiKey,
              Authorization: `Bearer ${token}`,
            },
            timeout: 30000, // 30 seconds timeout for AI service request
          },
        ),
      );

      return response.data;
    } catch (error: unknown) {
      // 1. Ambil pesan error dengan aman
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // 2. Pastikan dengan aman apakah ini AxiosError
      const isAxiosError = typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as AxiosError).isAxiosError;
      
      if (isAxiosError) {
        const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
        
        this.logger.error(
          `AI service HTTP error [user=${user?.username || 'unknown'}]: ${axiosError.message}`,
          axiosError.response?.data || axiosError.stack,
        );

        if (axiosError.response) {
          const statusCode: number = axiosError.response.status;
          const errorData = axiosError.response.data;

          // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- HTTP status codes are HttpStatus enum values
          if (statusCode === HttpStatus.UNAUTHORIZED) {
            throw new BadGatewayException({
              statusCode: HttpStatus.BAD_GATEWAY,
              message: 'AI service authentication failed',
              detail: errorData?.detail || 'Invalid or missing credentials to AI service',
            });
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
      } else {
        // Jika error bukan dari Axios (misalnya TypeError tak terduga)
        this.logger.error(
          `AI service internal error [user=${user?.username || 'unknown'}]: ${errorMessage}`,
          errorStack,
        );
      }

      // 3. Fallback aman untuk semua kondisi tanpa response (termasuk timeout dan network error)
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'AI service is unavailable or encountered an unexpected error',
      });
    }
  }
}
