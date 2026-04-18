import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, count, eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { Role } from '../../common/enums/role.enum';
import { CourierGateway } from '../courier-gateway/courier.gateway';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { haversineKm } from '../routing/dijkstra';
import { RoutingService } from '../routing/routing.service';

export interface OrderReadyEvent {
  orderId: number;
  organizationId: number;
  orgLat: number;
  orgLng: number;
  orgName: string;
  deliveryAddress: string;
  totalAmount: number;
}

/** Weight of geographic distance in the final score. */
const DISTANCE_WEIGHT = 0.7;
/** Weight of current workload in the final score. */
const WORKLOAD_WEIGHT = 0.3;

@Injectable()
export class CourierAssignmentService {
  private readonly logger = new Logger(CourierAssignmentService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly courierGateway: CourierGateway,
    private readonly routingService: RoutingService,
  ) {}

  /**
   * Picks the best courier for an order using a distance+workload score
   * and performs all side effects (DB update, WS notify, email, cache invalidation).
   */
  async assignCourierForOrder(event: OrderReadyEvent): Promise<void> {
    this.logger.log(`Auto-assigning courier for order #${event.orderId}`);

    const couriers = await this.db
      .select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.role, Role.COURIER));

    if (couriers.length === 0) {
      this.logger.warn(
        `No couriers in the system — order #${event.orderId} left unassigned`,
      );
      return;
    }

    // Count active (READY_FOR_DELIVERY) orders per courier to measure workload.
    const workloadMap = new Map<number, number>();
    for (const courier of couriers) {
      const [row] = await this.db
        .select({ total: count() })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.courierId, courier.id),
            eq(schema.orders.status, OrderStatus.READY_FOR_DELIVERY),
          ),
        );
      workloadMap.set(courier.id, Number(row.total));
    }

    // Read real-time locations from Redis (TTL-based: offline couriers have no key).
    const locationMap = new Map<number, { lat: number; lng: number }>();
    for (const courier of couriers) {
      const raw = await this.redisService.get(`courier:location:${courier.id}`);
      if (raw) {
        locationMap.set(
          courier.id,
          JSON.parse(raw) as { lat: number; lng: number },
        );
      }
    }

    const orgNode = { id: 0, lat: event.orgLat, lng: event.orgLng };

    /**
     * Scoring formula:
     *   score = α · (1 / (1 + distKm))  +  β · (1 / (1 + activeOrders))
     *
     * Couriers without a Redis location fall back to workload-only scoring
     * so they can still be assigned when no one is broadcasting position.
     */
    const scored = couriers.map((courier) => {
      const activeOrders = workloadMap.get(courier.id) ?? 0;
      const workloadScore = 1 / (1 + activeOrders);

      const location = locationMap.get(courier.id);
      if (location) {
        const distKm = haversineKm(orgNode, {
          id: courier.id,
          lat: location.lat,
          lng: location.lng,
        });
        const distScore = 1 / (1 + distKm);
        const score =
          DISTANCE_WEIGHT * distScore + WORKLOAD_WEIGHT * workloadScore;
        return { courier, score, distKm, activeOrders };
      }

      return {
        courier,
        score: WORKLOAD_WEIGHT * workloadScore,
        distKm: null as number | null,
        activeOrders,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    this.logger.log(
      `Selected courier #${best.courier.id} "${best.courier.fullName}" | ` +
        `score=${best.score.toFixed(3)}, ` +
        `dist=${best.distKm !== null ? best.distKm.toFixed(1) + ' km' : 'N/A (offline)'}, ` +
        `activeOrders=${best.activeOrders}`,
    );

    await this.db
      .update(schema.orders)
      .set({ courierId: best.courier.id })
      .where(eq(schema.orders.id, event.orderId));

    await this.routingService.invalidateCourierRoute(best.courier.id);

    this.courierGateway.notifyCourier(best.courier.id, event.orderId);

    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, event.orderId));

    try {
      await this.mailService.sendCourierAssigned(
        best.courier.email,
        best.courier.fullName ?? 'Courier',
        event.orderId,
        event.orgName,
        event.deliveryAddress,
        event.totalAmount,
        items.length,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send assignment email to courier #${best.courier.id}`,
        error,
      );
    }
  }
}
