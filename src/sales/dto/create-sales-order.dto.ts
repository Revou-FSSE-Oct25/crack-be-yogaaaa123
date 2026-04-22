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

export class SalesOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: '999.99',
    type: String,
    description: 'Unit selling price (use string to preserve decimal precision)',
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
