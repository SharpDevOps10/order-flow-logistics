import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [MailModule, RoutingModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
