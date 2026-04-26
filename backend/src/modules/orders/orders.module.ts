import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { MailModule } from '../mail/mail.module';
import { RoutingModule } from '../routing/routing.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    MailModule,
    RoutingModule,
    forwardRef(() => CourierGatewayModule),
    PricingModule,
    JwtModule.register({}),
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController],
  exports: [OrdersGateway],
})
export class OrdersModule {}
