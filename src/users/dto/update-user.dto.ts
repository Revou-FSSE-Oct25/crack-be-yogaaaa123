import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'New email for the user',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.ADMIN,
    description: 'New role for the user',
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
