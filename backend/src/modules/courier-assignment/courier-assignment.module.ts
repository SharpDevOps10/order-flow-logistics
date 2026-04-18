import { Module } from '@nestjs/common';
import { CourierAssignmentService } from './courier-assignment.service';
import { OrderEventsConsumer } from './order-events.consumer';
import { MailModule } from '../mail/mail.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [MailModule, CourierGatewayModule, RoutingModule],
  controllers: [OrderEventsConsumer],
  providers: [CourierAssignmentService],
})
export class CourierAssignmentModule {}
