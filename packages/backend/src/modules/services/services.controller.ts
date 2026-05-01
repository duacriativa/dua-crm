import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.prisma.service.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('form-options')
  async formOptions(@Request() req: any) {
    const services = await this.prisma.service.findMany({
      where: { tenantId: req.user.tenantId, isActive: true, isOnForm: true },
      select: { id: true, name: true, price: true, category: true },
      orderBy: { name: 'asc' },
    });
    return services;
  }

  @Post()
  create(
    @Request() req: any,
    @Body() body: {
      name: string; description?: string; price?: number; cost?: number;
      category?: string; isRecurring?: boolean; recurringPeriod?: string;
      isPublic?: boolean; isOnForm?: boolean; commission?: number;
    },
  ) {
    return this.prisma.service.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        description: body.description,
        price: body.price ?? 0,
        cost: body.cost ?? 0,
        category: body.category,
        isRecurring: body.isRecurring ?? false,
        recurringPeriod: body.recurringPeriod,
        isPublic: body.isPublic ?? true,
        isOnForm: body.isOnForm ?? true,
        commission: body.commission,
      },
    });
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      name?: string; description?: string; price?: number; cost?: number;
      category?: string; isRecurring?: boolean; recurringPeriod?: string;
      isPublic?: boolean; isOnForm?: boolean; commission?: number; isActive?: boolean;
    },
  ) {
    return this.prisma.service.updateMany({
      where: { id, tenantId: req.user.tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.cost !== undefined && { cost: body.cost }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
        ...(body.recurringPeriod !== undefined && { recurringPeriod: body.recurringPeriod }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
        ...(body.isOnForm !== undefined && { isOnForm: body.isOnForm }),
        ...(body.commission !== undefined && { commission: body.commission }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.prisma.service.deleteMany({
      where: { id, tenantId: req.user.tenantId },
    });
  }
}
