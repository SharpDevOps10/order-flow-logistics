import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { SignUpDto } from './dtos/signup.dto';
import { SignInDto } from './dtos/signin.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signUp(dto: SignUpDto) {
    const userExists = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email));
    if (userExists.length > 0)
      throw new BadRequestException('User already exists');

    const hashedPassword = await this.hashData(dto.password);

    const [newUser] = await this.db
      .insert(schema.users)
      .values({
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        role: dto.role || Role.CLIENT,
      })
      .returning();

    const tokens = await this.getTokens(
      newUser.id,
      newUser.email,
      newUser.role,
    );
    await this.updateRefreshTokenHash(newUser.id, tokens.refreshToken);

    return tokens;
  }

  async signIn(dto: SignInDto) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email));
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordMatches = await argon2.verify(user.password, dto.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid email or password');

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
