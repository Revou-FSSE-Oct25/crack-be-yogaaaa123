import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    enum: TenantRole,
    example: TenantRole.ADMIN,
    description: 'New role for the user',
  })
  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;
}
