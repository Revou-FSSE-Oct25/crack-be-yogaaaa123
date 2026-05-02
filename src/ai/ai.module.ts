import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 0,
    }),
    AuthModule, // Needed by JwtAuthGuard
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
