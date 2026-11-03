import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClientProfilesService } from './client-profiles.service';

/** Ficha de cadastro que o cliente preenche pelo link /cadastro/[token] (sem login). */
@Controller('public/cadastro')
export class PublicClientProfileController {
  constructor(private readonly profiles: ClientProfilesService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param('token') token: string) {
    return this.profiles.publicView(token);
  }

  @Post(':token')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  submit(@Param('token') token: string, @Body() body: any) {
    return this.profiles.submit(token, body);
  }
}

/** Tela "Cadastros" do CRM: gerar link, acompanhar quem preencheu e consultar a ficha. */
@Controller('client-profiles')
@UseGuards(JwtAuthGuard)
export class ClientProfilesController {
  constructor(private readonly profiles: ClientProfilesService) {}

  @Get()
  list(@Request() req: any) {
    return this.profiles.list(req.user.tenantId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.profiles.create(req.user.tenantId, body);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.profiles.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.profiles.remove(req.user.tenantId, id);
  }
}
