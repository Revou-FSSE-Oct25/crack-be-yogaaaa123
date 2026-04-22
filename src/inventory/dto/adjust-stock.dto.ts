import { IsNumber, IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({
    example: 10,
    description: 'Positive to add stock, negative to remove',
  })
  @IsNumber()
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
