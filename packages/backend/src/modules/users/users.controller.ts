import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Post()
  @Roles('OWNER')
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, dto);
  }
}
