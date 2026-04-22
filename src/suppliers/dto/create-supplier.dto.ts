import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Tech Corp' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@techcorp.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '123 Tech Lane, Silicon Valley' })
  @IsString()
  @IsOptional()
  address?: string;
}
