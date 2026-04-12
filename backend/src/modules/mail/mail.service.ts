import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendOrganizationApproved(
    email: string,
    ownerName: string,
    organizationName: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: `✅ Your organization «${organizationName}» has been approved!`,
      template: './organization-approved',
      context: {
        ownerName,
        organizationName,
        year: new Date().getFullYear(),
      },
    });
  }
}
