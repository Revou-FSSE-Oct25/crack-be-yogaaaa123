import { IsString, MinLength, MaxLength, Matches, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'Toko Sembako Makmur',
    description: 'Nama toko / tenant',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  storeName: string;

  @ApiProperty({
    example: 'admin',
    description: 'Username untuk login (min 3 karakter, huruf/angka/underscore)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username hanya boleh berisi huruf, angka, dan underscore',
  })
  username: string;

  @ApiProperty({
    example: 'owner@email.com',
    description: 'Email pemilik toko (untuk recovery akun)',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @ApiProperty({
    example: 'StrongP@ss123',
    description: 'Password (min 8 karakter, harus ada huruf besar, huruf kecil, dan angka)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password harus memiliki minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka',
  })
  password: string;

  @ApiProperty({
    example: 'Toko Sembako',
    description: 'Nama display (optional, default = username)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
