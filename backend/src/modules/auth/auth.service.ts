import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { SignUpDto } from './dtos/signup.dto';
import { SignInDto } from './dtos/signin.dto';
import { Role } from '../../common/enums/role.enum';
import { MailService } from '../mail/mail.service';

const VERIFICATION_EXPIRES_HOURS = 24;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async signUp(dto: SignUpDto) {
    const userExists = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email));
    if (userExists.length > 0)
      throw new BadRequestException('User already exists');

    const hashedPassword = await this.hashData(dto.password);
    const { token, expiresAt } = this.generateVerificationToken();

    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        role: dto.role || Role.CLIENT,
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      })
      .returning();

    await this.mailService.sendEmailVerification(
      newUser.email,
      newUser.fullName,
      token,
      VERIFICATION_EXPIRES_HOURS,
    );

    return {
      message:
        'Account created. Please check your email to confirm your address before signing in.',
      email: newUser.email,
    };
  }

  async signIn(dto: SignInDto) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email));
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordMatches = await argon2.verify(user.password, dto.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid email or password');

    if (!user.isEmailVerified)
      throw new ForbiddenException(
        'Please confirm your email address before signing in.',
      );

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: number) {
    await this.db
      .update(schema.users)
      .set({ refreshToken: null })
      .where(eq(schema.users.id, userId));
  }

  async refreshTokens(userId: number, refreshToken: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access Denied');

    const refreshTokenMatches = await argon2.verify(
      user.refreshToken,
      refreshToken,
    );
    if (!refreshTokenMatches) throw new UnauthorizedException('Access Denied');

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async verifyEmail(token: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.emailVerificationToken, token),
          gt(schema.users.emailVerificationExpiresAt, new Date()),
        ),
      );
    if (!user)
      throw new BadRequestException('Verification link is invalid or expired.');

    await this.db
      .update(schema.users)
      .set({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      })
      .where(eq(schema.users.id, user.id));

    return { message: 'Email confirmed. You can now sign in.' };
  }

  async resendVerification(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified)
      throw new BadRequestException('Email is already confirmed.');

    const { token, expiresAt } = this.generateVerificationToken();

    await this.db
      .update(schema.users)
      .set({
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      })
      .where(eq(schema.users.id, user.id));

    await this.mailService.sendEmailVerification(
      user.email,
      user.fullName,
      token,
      VERIFICATION_EXPIRES_HOURS,
    );

    return { message: 'Verification email sent. Please check your inbox.' };
  }

  private generateVerificationToken() {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000,
    );
    return { token, expiresAt };
  }

  private hashData(data: string) {
    return argon2.hash(data);
  }

  private async getTokens(userId: number, email: string, role: string) {
    const jwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET')!,
        expiresIn: parseInt(
          this.configService.get<string>('JWT_ACCESS_EXPIRATION')!,
          10,
        ),
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: parseInt(
          this.configService.get<string>('JWT_REFRESH_EXPIRATION')!,
          10,
        ),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshTokenHash(userId: number, refreshToken: string) {
    const hash = await this.hashData(refreshToken);
    await this.db
      .update(schema.users)
      .set({ refreshToken: hash })
      .where(eq(schema.users.id, userId));
  }
}
