import { Module } from '@nestjs/common';
import { CourierAssignmentService } from './courier-assignment.service';
import { MailModule } from '../mail/mail.module';
import { CourierGatewayModule } from '../courier-gateway/courier-gateway.module';

@Module({
  imports: [MailModule, CourierGatewayModule],
  providers: [CourierAssignmentService],
})
export class CourierAssignmentModule {}
