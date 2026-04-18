import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LeadsService, CreatePublicLeadDto } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreatePublicLeadDto) {
    return this.leadsService.createPublicLead(dto);
  }
}
