import {
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnItemDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the specific OrderItem being returned',
  })
  @IsUUID()
  orderItemId: string;

  @ApiProperty({ example: 1, description: 'Quantity to return' })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateReturnDto {
  @ApiProperty({ example: 'RET-1001' })
  @IsString()
  returnNumber: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the SalesOrder this return belongs to',
  })
  @IsUUID()
  salesOrderId: string;

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
