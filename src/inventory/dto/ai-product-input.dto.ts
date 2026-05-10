import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiProductItemDto {
  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  @MinLength(2)
  sku!: string;

  @ApiProperty({ example: 'Arabica Coffee Beans' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '75000' })
  @IsString()
  price!: string;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @ApiPropertyOptional({ example: 'Minuman' })
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ApiPropertyOptional({ example: 'PT Kopi Nusantara' })
  @IsString()
  @IsOptional()
  supplierName?: string;
}

export class AiProductInputDto {
  @ApiProperty({ type: [AiProductItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one product required' })
  @ValidateNested({ each: true })
  @Type(() => AiProductItemDto)
  products!: AiProductItemDto[];
}
