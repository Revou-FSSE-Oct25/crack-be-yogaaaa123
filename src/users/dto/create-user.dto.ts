import { IsString, IsEnum, MinLength, IsOptional } from 'class-validator';
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

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;
}
