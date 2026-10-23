import { Controller, Post, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
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

  /** GET /users/me/signatures — assinaturas do usuário logado */
  @Get('me/signatures')
  getSignatures(@Req() req: any) {
    return this.usersService.getSignatures(req.user.id);
  }

  /** PUT /users/me/signatures — salva a lista e a assinatura selecionada */
  @Put('me/signatures')
  saveSignatures(@Req() req: any, @Body() body: { signatures: string[]; signature?: string }) {
    return this.usersService.saveSignatures(req.user.id, body.signatures, body.signature);
  }

  @Post()
  @Roles('OWNER')
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.user.tenantId, dto);
  }
}
