import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  NotEquals,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  productId: string;

  @ApiProperty({
    example: 10,
    description: 'Positive to add stock, negative to remove. Cannot be 0.',
  })
  @IsNumber()
  @NotEquals(0, { message: 'quantityChange must not be 0' })
  quantityChange: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiPropertyOptional({ example: 'REF-001' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'Manual stock correction' })
  @IsString()
  @IsOptional()
  notes?: string;
}
