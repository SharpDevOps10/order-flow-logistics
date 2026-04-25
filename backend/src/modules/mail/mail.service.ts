import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendEmailVerification(
    email: string,
    fullName: string,
    token: string,
    expiresInHours: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    try {
      const info = await this.mailerService.sendMail({
        to: email,
        subject: 'Confirm your email — Order Flow Logistics',
        template: './email-verification',
        context: {
          fullName,
          verificationUrl,
          expiresInHours,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(
        `Verification email sent to ${email} (messageId=${info?.messageId ?? 'n/a'})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

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

  async sendCourierAssigned(
    email: string,
    courierName: string,
    orderId: number,
    organizationName: string,
    deliveryAddress: string,
    totalAmount: number,
    itemCount: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    await this.mailerService.sendMail({
      to: email,
      subject: `📦 New Delivery Order #${orderId} Assigned`,
      template: './courier-assigned',
      context: {
        courierName,
        orderId,
        organizationName,
        deliveryAddress,
        totalAmount,
        itemCount,
        dashboardUrl: `${frontendUrl}/courier/deliveries`,
        year: new Date().getFullYear(),
      },
    });
  }
}
