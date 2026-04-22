import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsNumberString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: '800.00',
    type: String,
    description: 'Unit price from supplier (use string to preserve decimal precision)',
  })
  @IsNumberString()
  unitPrice: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'PO-2001' })
  @IsString()
  orderNumber: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  supplierId: number;

  @ApiPropertyOptional({ example: 'Urgent restock' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
