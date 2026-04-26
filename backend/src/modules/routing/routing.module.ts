import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { OsmService } from './osm.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [RoutingController],
  providers: [RoutingService, OsmService],
  exports: [RoutingService],
})
export class RoutingModule {}
