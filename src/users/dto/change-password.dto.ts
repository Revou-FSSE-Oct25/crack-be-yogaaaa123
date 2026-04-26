import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123',
    description: 'The current password of the user',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'NewSecurePassword456!',
    description: 'The new password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
