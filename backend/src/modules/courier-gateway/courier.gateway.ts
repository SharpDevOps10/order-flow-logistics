import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { Role } from '../../common/enums/role.enum';

const LOCATION_TTL_SECONDS = 300;
const LOCATION_HISTORY_TTL_SECONDS = 24 * 60 * 60;
const LOCATION_HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface LocationPayload {
  lat: number;
  lng: number;
}

interface ServerToClientEvents {
  'order:assigned': (payload: { orderId: number }) => void;
  'order:reassigned_away': (payload: {
    orderId: number;
    reason: 'optimization';
  }) => void;
}

interface SocketData {
  userId: number;
  role: Role;
}

type CourierSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway({ cors: { origin: '*' } })
export class CourierGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CourierGateway.name);
  private readonly clients = new Map<number, CourierSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  handleConnection(client: CourierSocket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<{
        sub: number;
        role: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role as Role;

      this.clients.set(payload.sub, client);
      this.logger.log(`Courier #${payload.sub} connected`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: CourierSocket) {
    if (client.data.userId) {
      this.clients.delete(client.data.userId);
      this.logger.log(`Courier #${client.data.userId} disconnected`);
    }
  }

  notifyCourier(courierId: number, orderId: number): void {
    const client = this.clients.get(courierId);
    if (client) {
      client.emit('order:assigned', { orderId });
      this.logger.log(`Notified courier #${courierId} about order #${orderId}`);
    }
  }

  notifyReassignedAway(courierId: number, orderId: number): void {
    const client = this.clients.get(courierId);
    if (client) {
      client.emit('order:reassigned_away', {
        orderId,
        reason: 'optimization',
      });
      this.logger.log(
        `Notified courier #${courierId} that order #${orderId} was reassigned away`,
      );
    }
  }

  @SubscribeMessage('courier:location')
  async handleLocation(
    @ConnectedSocket() client: CourierSocket,
    @MessageBody() data: LocationPayload,
  ) {
    if (client.data.role !== Role.COURIER) return;

    const courierId = client.data.userId;

    await this.redisService.set(
      `courier:location:${courierId}`,
      JSON.stringify({ lat: data.lat, lng: data.lng }),
      LOCATION_TTL_SECONDS,
    );

    const now = Date.now();
    const historyKey = `courier:location:history:${courierId}`;
    await this.redisService.zadd(
      historyKey,
      now,
      JSON.stringify({ lat: data.lat, lng: data.lng, t: now }),
    );
    await this.redisService.zremRangeByScore(
      historyKey,
      0,
      now - LOCATION_HISTORY_MAX_AGE_MS,
    );
    await this.redisService.expire(historyKey, LOCATION_HISTORY_TTL_SECONDS);

    this.logger.debug(
      `Location updated: courier #${courierId} → (${data.lat}, ${data.lng})`,
    );
  }
}
