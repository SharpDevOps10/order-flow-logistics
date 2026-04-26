import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';
import { RoutingModule } from '../routing/routing.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [MailModule, RoutingModule, CourierGatewayModule, PricingModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
