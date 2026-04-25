import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Process a sales return (Admin only)' })
  createReturn(
    @Body() createReturnDto: CreateReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.returnsService.createReturn(createReturnDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all returns' })
  findAll() {
    return this.returnsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a return by id' })
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }
}
