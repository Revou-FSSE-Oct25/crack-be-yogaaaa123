import { IsString, IsEnum, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe', description: 'The username of the user' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: TenantRole,
    example: TenantRole.STAFF,
    description: 'The role of the user',
  })
  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Tenant ID (optional)',
  })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}
