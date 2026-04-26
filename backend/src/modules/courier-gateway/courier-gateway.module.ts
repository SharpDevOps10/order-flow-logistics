import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CourierGateway } from './courier.gateway';
import { CourierStatsService } from './courier-stats.service';
import { CourierStatsController } from './courier-stats.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => OrdersModule)],
  controllers: [CourierStatsController],
  providers: [CourierGateway, CourierStatsService],
  exports: [CourierGateway, CourierStatsService],
})
export class CourierGatewayModule {}
