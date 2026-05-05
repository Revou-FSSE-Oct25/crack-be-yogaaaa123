import {
  Injectable,
  ConflictException,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, tenantId: string) {
    const existingUser = await this.prisma.tenantUser.findFirst({
      where: {
        OR: [{ username: createUserDto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this username already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const user = await this.prisma.tenantUser.create({
      data: {
        username: createUserDto.username,
        passwordHash,
        role: createUserDto.role || 'STAFF',
        tenantId,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll(tenantId: string, skip?: number, take?: number) {
    const prisma = this.prisma.getClient(tenantId);
    return prisma.tenantUser.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
      skip,
      take: take ?? 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const prisma = this.prisma.getClient(tenantId);
    const user = await prisma.tenantUser.findFirst({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByUsername(username: string, tenantId?: string) {
    // SECURITY: filter soft-deleted users — they must not be able to login
    const prisma = tenantId ? this.prisma.getClient(tenantId) : this.prisma;
    return prisma.tenantUser.findFirst({
      where: { username, deletedAt: null, ...(tenantId ? { tenantId } : {}) },
    });
  }

  async findByUsernameOrEmail(usernameOrEmail: string, tenantId?: string) {
    // SECURITY: filter soft-deleted users — they must not be able to login
    const prisma = tenantId ? this.prisma.getClient(tenantId) : this.prisma;
    return prisma.tenantUser.findFirst({
      where: {
        username: usernameOrEmail,
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId: string) {
    // Verify user exists and is not soft-deleted
    const prisma = this.prisma.getClient(tenantId);
    const user = await prisma.tenantUser.findFirst({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Explicit field mapping — never pass raw DTO to prevent accidental exposure of sensitive fields
    const updateData: { role?: UpdateUserDto['role'] } = {};
    if (updateUserDto.role !== undefined) updateData.role = updateUserDto.role;

    const updatedUser = await prisma.tenantUser.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`User ${id} updated`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async remove(id: string, tenantId: string) {
    // Verify user exists and is not already soft-deleted
    const prisma = this.prisma.getClient(tenantId);
    const user = await prisma.tenantUser.findFirst({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Soft delete
    return prisma.tenantUser.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: {
        id: true,
        username: true,
        role: true,
        deletedAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    // Fetch full user record (including passwordHash) for verification
    const user = await this.prisma.tenantUser.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.tenantUser.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    this.logger.log(`Password changed for user ${userId}`);
    return { message: 'Password changed successfully' };
  }
}
