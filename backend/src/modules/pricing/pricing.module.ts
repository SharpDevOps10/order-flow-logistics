import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { RoadDistanceService } from './road-distance.service';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [ShiftsModule],
  providers: [PricingService, RoadDistanceService],
  exports: [PricingService, RoadDistanceService],
})
export class PricingModule {}
