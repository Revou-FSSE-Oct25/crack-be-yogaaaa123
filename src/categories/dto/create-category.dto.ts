import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Electronic gadgets and devices' })
  @IsString()
  @IsOptional()
  description?: string;
}
