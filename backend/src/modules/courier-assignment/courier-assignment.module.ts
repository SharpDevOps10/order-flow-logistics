import { Module } from '@nestjs/common';
import { CourierAssignmentService } from './courier-assignment.service';
import { OrderEventsConsumer } from './order-events.consumer';
import { BatchAssignmentService } from './batch-assignment.service';
import { BatchAssignmentScheduler } from './batch-assignment.scheduler';
import { BatchAssignmentController } from './batch-assignment.controller';
import { MailModule } from '../mail/mail.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';
import { RoutingModule } from '../routing/routing.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    MailModule,
    CourierGatewayModule,
    RoutingModule,
    ReviewsModule,
    ShiftsModule,
  ],
  controllers: [OrderEventsConsumer, BatchAssignmentController],
  providers: [
    CourierAssignmentService,
    BatchAssignmentService,
    BatchAssignmentScheduler,
  ],
})
export class CourierAssignmentModule {}
