import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesOrderItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: '999.99',
    type: String,
    description:
      'Unit selling price (use string to preserve decimal precision)',
  })
  @IsNumberString()
  unitPrice: string;
}

export class CreateSalesOrderDto {
  @ApiProperty({ example: 'SO-1001' })
  @IsString()
  orderNumber: string;

  @ApiPropertyOptional({ example: 'CUST-001' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ type: [SalesOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items: SalesOrderItemDto[];
}
