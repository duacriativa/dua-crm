import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  Res,
  HttpCode,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as crypto from 'crypto';
import { WhatsAppService } from './whatsapp.service';

/**
 * Webhook da Meta Cloud API para WhatsApp.
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  /**
   * GET — verificação do webhook pela Meta.
   * A Meta envia hub.challenge e espera receber de volta.
   */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === expectedToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  /**
   * POST — recebe eventos (mensagens, status, etc.) da Meta.
   * Valida assinatura HMAC-SHA256 antes de processar.
   */
  @Post()
  @HttpCode(200)
  async receive(
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    // A Meta exige resposta 200 em < 20s, mesmo que ocorra erro interno
    // Por isso respondemos imediatamente e processamos de forma assíncrona
    this.validateSignature(signature, body);
    res.status(200).send('OK');

    // Processar em background (não bloqueia a resposta)
    this.whatsapp.processWebhookEvent(body).catch((err) => {
      console.error('[WhatsApp Webhook] Erro ao processar evento:', err);
    });
  }

  private validateSignature(signature: string, body: any) {
    if (!signature) throw new UnauthorizedException('Assinatura ausente.');

    const secret = process.env.META_APP_SECRET;
    const rawBody = JSON.stringify(body);
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    // Comparação com tempo constante para evitar timing attacks
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);

    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }
  }
}
