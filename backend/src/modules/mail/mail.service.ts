import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendOrganizationApproved(
    email: string,
    ownerName: string,
    organizationName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    await this.mailerService.sendMail({
      to: email,
      subject: `✅ Your organization «${organizationName}» has been approved!`,
      template: './organization-approved',
      context: {
        ownerName,
        organizationName,
        dashboardUrl: `${frontendUrl}/supplier/organizations`,
        year: new Date().getFullYear(),
      },
    });
  }
}
