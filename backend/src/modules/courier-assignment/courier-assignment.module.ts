import { Module } from '@nestjs/common';
import { CourierAssignmentService } from './courier-assignment.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [CourierAssignmentService],
})
export class CourierAssignmentModule {}
