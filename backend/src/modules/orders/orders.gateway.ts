import { Inject, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { Role } from '../../common/enums/role.enum';
import { and, inArray } from 'drizzle-orm';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { RoutingService } from '../routing/routing.service';
import { RoadDistanceService } from '../pricing/road-distance.service';
import { CourierStatsService } from '../courier-gateway/courier-stats.service';

interface OrderUpdatedPayload {
  id: number;
  organizationId: number;
  clientId: number;
  status: string;
  courierId: number | null;
  courierName?: string | null;
}

interface OrderRemovedPayload {
  id: number;
  organizationId: number;
  clientId: number;
}

interface CourierPositionPayload {
  orderId: number;
  lat: number;
  lng: number;
  at: number;
  firstSegmentKm?: number;
  firstSegmentDurationSec?: number;
  avgSpeedKmh?: number;
  isFallbackSpeed?: boolean;
}

interface ServerToClientEvents {
  'order:created': (payload: unknown) => void;
  'order:updated': (payload: OrderUpdatedPayload) => void;
  'order:removed': (payload: OrderRemovedPayload) => void;
  'courier:position': (payload: CourierPositionPayload) => void;
}

interface SocketData {
  userId: number;
  role: Role;
}

type ClientSocket = Socket<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const userRoom = (userId: number) => `user:${userId}`;
const orgRoom = (orgId: number) => `org:${orgId}`;

@WebSocketGateway({ namespace: 'orders', cors: { origin: '*' } })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private server!: Server<
    Record<string, never>,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly routingService: RoutingService,
    private readonly roadDistanceService: RoadDistanceService,
    private readonly courierStatsService: CourierStatsService,
  ) {}

  async handleConnection(client: ClientSocket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    let payload: { sub: number; role: string };
    try {
      payload = this.jwtService.verify<{ sub: number; role: string }>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.disconnect();
      return;
    }

    const role = payload.role as Role;
    if (role !== Role.CLIENT && role !== Role.SUPPLIER) {
      client.disconnect();
      return;
    }

    client.data.userId = payload.sub;
    client.data.role = role;

    await client.join(userRoom(payload.sub));

    if (role === Role.SUPPLIER) {
      const orgs = await this.db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.ownerId, payload.sub));
      await Promise.all(orgs.map((o) => client.join(orgRoom(o.id))));
      this.logger.log(
        `Supplier #${payload.sub} connected (${orgs.length} orgs)`,
      );
    } else {
      this.logger.log(`Client #${payload.sub} connected`);
    }
  }

  handleDisconnect(client: ClientSocket) {
    if (client.data.userId) {
      this.logger.log(
        `${client.data.role ?? 'user'} #${client.data.userId} disconnected`,
      );
    }
  }

  emitOrderCreated(orgId: number, clientId: number, payload: unknown) {
    this.server.to(orgRoom(orgId)).emit('order:created', payload);
    this.server.to(userRoom(clientId)).emit('order:created', payload);
  }

  emitOrderUpdated(payload: OrderUpdatedPayload) {
    this.server.to(orgRoom(payload.organizationId)).emit('order:updated', payload);
    this.server.to(userRoom(payload.clientId)).emit('order:updated', payload);
  }

  emitOrderRemoved(payload: OrderRemovedPayload) {
    this.server.to(orgRoom(payload.organizationId)).emit('order:removed', payload);
    this.server.to(userRoom(payload.clientId)).emit('order:removed', payload);
  }

  async broadcastCourierPosition(
    courierId: number,
    lat: number,
    lng: number,
  ): Promise<{
    firstSegmentKm: number | null;
    firstSegmentDurationSec: number | null;
    avgSpeedKmh: number;
    isFallbackSpeed: boolean;
  } | null> {
    try {
      const orders = await this.db
        .select({
          id: schema.orders.id,
          clientId: schema.orders.clientId,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.courierId, courierId),
            inArray(schema.orders.status, [
              OrderStatus.READY_FOR_DELIVERY,
              OrderStatus.PICKED_UP,
            ]),
          ),
        );

      if (orders.length === 0) return null;

      const at = Date.now();
      const [firstSegment, speed] = await Promise.all([
        this.computeFirstSegment(courierId, { lat, lng }),
        this.courierStatsService.getAverageSpeed(courierId),
      ]);

      for (const o of orders) {
        this.server.to(userRoom(o.clientId)).emit('courier:position', {
          orderId: o.id,
          lat,
          lng,
          at,
          ...(firstSegment.km !== null && { firstSegmentKm: firstSegment.km }),
          ...(firstSegment.durationSec !== null && {
            firstSegmentDurationSec: firstSegment.durationSec,
          }),
          avgSpeedKmh: speed.avgSpeedKmh,
          isFallbackSpeed: speed.isFallback,
        });
      }
      return {
        firstSegmentKm: firstSegment.km,
        firstSegmentDurationSec: firstSegment.durationSec,
        avgSpeedKmh: speed.avgSpeedKmh,
        isFallbackSpeed: speed.isFallback,
      };
    } catch (e) {
      this.logger.warn(
        `Failed to broadcast courier position for #${courierId}: ${String(e)}`,
      );
      return null;
    }
  }

  private async computeFirstSegment(
    courierId: number,
    courierPos: { lat: number; lng: number },
  ): Promise<{ km: number | null; durationSec: number | null }> {
    try {
      const routes = await this.routingService.getOptimizedRoute(courierId);
      let firstWp: { lat: number; lng: number } | null = null;
      outer: for (const route of routes) {
        for (const wp of route.waypoints) {
          if (!wp.completed) {
            firstWp = { lat: wp.lat, lng: wp.lng };
            break outer;
          }
        }
      }
      if (!firstWp) return { km: null, durationSec: null };

      const result = await this.roadDistanceService.getDistanceKm(
        courierPos,
        firstWp,
      );
      return { km: result.km, durationSec: result.durationSec };
    } catch {
      return { km: null, durationSec: null };
    }
  }
}
