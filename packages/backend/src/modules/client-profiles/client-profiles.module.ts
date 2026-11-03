import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientProfilesService } from './client-profiles.service';
import { ClientProfilesController, PublicClientProfileController } from './client-profiles.controller';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PublicClientProfileController, ClientProfilesController],
  providers: [ClientProfilesService],
})
export class ClientProfilesModule {}
