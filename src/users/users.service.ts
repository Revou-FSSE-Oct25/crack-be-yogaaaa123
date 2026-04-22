import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or username already exists',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        email: createUserDto.email,
        passwordHash,
        role: createUserDto.role || 'STAFF',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      where: {
        deletedAt: null,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }
}
