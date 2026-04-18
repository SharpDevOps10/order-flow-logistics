import { Module } from '@nestjs/common';
import { CourierAssignmentService } from './courier-assignment.service';
import { MailModule } from '../mail/mail.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [MailModule, CourierGatewayModule, RoutingModule],
  providers: [CourierAssignmentService],
})
export class CourierAssignmentModule {}
