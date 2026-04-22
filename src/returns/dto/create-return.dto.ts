import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnItemDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the specific OrderItem being returned',
  })
  @IsNumber()
  orderItemId: number;

  @ApiProperty({ example: 1, description: 'Quantity to return' })
  @IsNumber()
  quantity: number;
}

export class CreateReturnDto {
  @ApiProperty({ example: 'RET-1001' })
  @IsString()
  returnNumber: string;

  @ApiProperty({
    example: 1,
    description: 'ID of the SalesOrder this return belongs to',
  })
  @IsNumber()
  salesOrderId: number;

  @ApiPropertyOptional({ example: 'Customer received damaged item' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}
