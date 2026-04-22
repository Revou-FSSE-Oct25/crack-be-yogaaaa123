import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin1', description: 'The username of the user' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'password123', description: 'The password' })
  @IsString()
  @MinLength(6)
  password: string;
}
