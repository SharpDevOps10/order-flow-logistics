import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CourierGateway } from './courier.gateway';
import { CourierStatsService } from './courier-stats.service';
import { CourierStatsController } from './courier-stats.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CourierStatsController],
  providers: [CourierGateway, CourierStatsService],
  exports: [CourierGateway, CourierStatsService],
})
export class CourierGatewayModule {}
