import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiChatRequestDto } from './dto/ai-chat-request.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';

@ApiTags('ai')
@ApiBearerAuth()
@ApiHeader({
  name: 'Authorization',
  description: 'Bearer JWT token (same as NestJS backend auth)',
  required: true,
  example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
})
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Chat with AI Assistant (authenticated users)',
    description: `
Kirim pesan ke AI asisten untuk bertanya tentang data bisnis secara real-time.

**Cara Kerja:**
1. User mengirim pesan (misal: "Tampilkan produk yang stoknya hampir habis")
2. AI akan menentukan tool/data apa yang dibutuhkan
3. AI mengambil data langsung dari database
4. AI memberikan jawaban berdasarkan data nyata

**Pertanyaan yang bisa diajukan:**
- Dashboard: ringkasan penjualan, total revenue, produk terlaris
- Produk: cari produk, stok menipis, detail produk
- Penjualan: laporan penjualan, profit/loss, retur
- Inventory: nilai inventory, transaksi stok
- Kategori & Supplier: daftar kategori, supplier
- Admin only: daftar user, activity log, purchase orders

**Rate Limit:** 10 request per 60 detik (biaya LLM API mahal)
    `,
  })
  @ApiBody({ type: AiChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'AI response with reply text and tools used',
    schema: {
      example: {
        reply:
          'Berikut adalah produk dengan stok menipis:\n1. **iPhone 15** - Stok: 3 (Re-order: 10)\n2. **Samsung Galaxy** - Stok: 5 (Re-order: 8)',
        toolsUsed: ['get_low_stock_products'],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT token' })
  @ApiResponse({ status: 429, description: 'Too Many Requests — rate limit exceeded (10/60s)' })
  @ApiResponse({
    status: 500,
    description: 'AI service internal error or Python AI service unreachable',
  })
  async chat(
    @Body() body: AiChatRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    // Read JWT from cookie (HttpOnly) or Authorization Bearer header (client-set)
    const token = req.cookies?.auth_token || req.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    const result = await this.aiService.chat(body.message, body.history || [], token, user);

    return result;
  }
}
