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

/** TTL for courier location in Redis (5 minutes). */
const LOCATION_TTL_SECONDS = 300;

interface LocationPayload {
  lat: number;
  lng: number;
}

interface ServerToClientEvents {
  'order:assigned': (payload: { orderId: number }) => void;
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

    this.logger.debug(
      `Location updated: courier #${courierId} → (${data.lat}, ${data.lng})`,
    );
  }
}
