import {
  IsString,
  IsNumberString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'SKU-1001' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'iPhone 15' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Latest Apple Smartphone' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '999.99',
    type: String,
    description: 'Product selling price (use string to preserve decimal precision)',
  })
  @IsNumberString()
  price: string;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  reorderLevel?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  supplierId?: number;
}
