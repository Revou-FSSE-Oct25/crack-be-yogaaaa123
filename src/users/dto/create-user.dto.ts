import {
  IsString,
  IsEmail,
  IsEnum,
  MinLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'johndoe', description: 'The username of the user' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.STAFF,
    description: 'The role of the user',
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
