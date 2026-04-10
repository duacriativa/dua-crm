import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /** GET /conversations?status=OPEN&search=ana&page=1&limit=30 */
  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.findAll(req.user.tenantId, {
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
    });
  }

  /** GET /conversations/:id */
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.findOne(req.user.tenantId, id);
  }

  /** GET /conversations/:id/messages?page=1 */
  @Get(':id/messages')
  getMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.getMessages(
      req.user.tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** POST /conversations/start — inicia conversa outbound por telefone */
  @Post('start')
  startConversation(
    @Request() req: any,
    @Body() body: { phone: string; name?: string; message?: string },
  ) {
    return this.conversationsService.startConversation(
      req.user.tenantId,
      body.phone,
      body.name,
      body.message,
    );
  }

  /** POST /conversations/:id/messages — envia mensagem */
  @Post(':id/messages')
  sendMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { content: string; quotedExternalId?: string; quotedContent?: string; quotedType?: string },
  ) {
    return this.conversationsService.sendMessage(
      req.user.tenantId, id, body.content,
      body.quotedExternalId, body.quotedContent, body.quotedType,
    );
  }

  /** DELETE /conversations/:id — exclui conversa e mensagens */
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.conversationsService.remove(req.user.tenantId, id);
  }

  /** PATCH /conversations/:id/status */
  @Patch(':id/status')
  updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.conversationsService.updateStatus(req.user.tenantId, id, status);
  }
}
