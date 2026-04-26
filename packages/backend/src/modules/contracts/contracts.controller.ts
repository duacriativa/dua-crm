import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Request,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContractDto } from './dto/create-contract.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.contractsService.findAll(req.user.tenantId);
  }

  @Get('anniversaries')
  getAnniversaries(@Request() req: any) {
    return this.contractsService.getUpcomingAnniversaries(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.contractsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Body() dto: CreateContractDto, @Request() req: any) {
    return this.contractsService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateContractDto>,
    @Request() req: any,
  ) {
    return this.contractsService.update(req.user.tenantId, id, dto);
  }
}
