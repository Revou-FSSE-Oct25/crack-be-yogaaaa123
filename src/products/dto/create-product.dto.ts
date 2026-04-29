import { IsString, IsNumberString, IsNumber, IsOptional, Min, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  supplierId?: string;
}
