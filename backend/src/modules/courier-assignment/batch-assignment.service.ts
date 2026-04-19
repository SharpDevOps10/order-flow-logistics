import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { RedisService } from '../redis/redis.service';
import { Role } from '../../common/enums/role.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { haversineKm } from '../routing/dijkstra';
import { RoutingService } from '../routing/routing.service';
import { CourierGateway } from '../courier-gateway/courier.gateway';
import { hungarian } from './hungarian';

const COURIER_CAPACITY = 3;
const LOAD_PENALTY_KM = 3.0;
const REASSIGN_THRESHOLD = 0.15;
const DUMMY_COST = 1e6;

interface BatchOrder {
  id: number;
  organizationId: number;
  courierId: number | null;
  orgLat: number;
  orgLng: number;
  deliveryLat: number;
  deliveryLng: number;
  orderIntrinsicKm: number;
}

interface BatchCourier {
  id: number;
  lat: number;
  lng: number;
  online: boolean;
  activeOrders: number;
}

export interface RebalanceResult {
  orders: number;
  couriers: number;
  reassignments: Array<{
    orderId: number;
    from: number | null;
    to: number;
    savedKm: number;
  }>;
  totalCostBefore: number;
  totalCostAfter: number;
}

@Injectable()
export class BatchAssignmentService {
  private readonly logger = new Logger(BatchAssignmentService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly redisService: RedisService,
    private readonly routingService: RoutingService,
    private readonly courierGateway: CourierGateway,
  ) {}

  async rebalance(): Promise<RebalanceResult> {
    const orders = await this.loadEligibleOrders();
    const couriers = await this.loadAvailableCouriers();

    const empty: RebalanceResult = {
      orders: orders.length,
      couriers: couriers.length,
      reassignments: [],
      totalCostBefore: 0,
      totalCostAfter: 0,
    };

    if (orders.length === 0 || couriers.length === 0) {
      this.logger.log(
        `Rebalance skipped: ${orders.length} orders, ${couriers.length} couriers`,
      );
      return empty;
    }

    const { matrix, slotOwner, slotIndex } = this.buildCostMatrix(
      orders,
      couriers,
    );

    const size = Math.max(matrix.length, matrix[0]?.length ?? 0);
    const square = this.padToSquare(matrix, size);

    const { assignment } = hungarian(square);

    const result: RebalanceResult = { ...empty, reassignments: [] };
    const touchedCouriers = new Set<number>();

    for (let i = 0; i < orders.length; i++) {
      const slot = assignment[i];
      if (slot < 0 || slot >= slotOwner.length) continue;

      const order = orders[i];
      const newCourierId = slotOwner[slot];
      const newSlotIdx = slotIndex[slot];
      const newCost = matrix[i][slot];

      const currentCost = this.currentAssignmentCost(order, couriers);
      result.totalCostBefore += currentCost;
      result.totalCostAfter += newCost;

      if (order.courierId === newCourierId) continue;

      const savedKm = currentCost - newCost;
      const relativeImprovement =
        currentCost > 0 ? savedKm / currentCost : Infinity;

      if (relativeImprovement < REASSIGN_THRESHOLD) continue;

      await this.db
        .update(schema.orders)
        .set({ courierId: newCourierId })
        .where(eq(schema.orders.id, order.id));

      result.reassignments.push({
        orderId: order.id,
        from: order.courierId,
        to: newCourierId,
        savedKm: Math.round(savedKm * 100) / 100,
      });

      this.logger.log(
        `Reassigned order #${order.id}: courier ${order.courierId ?? 'none'} → #${newCourierId} ` +
          `(slot ${newSlotIdx}, saved ${savedKm.toFixed(2)} km)`,
      );

      if (order.courierId !== null) {
        touchedCouriers.add(order.courierId);
        this.courierGateway.notifyReassignedAway(order.courierId, order.id);
      }
      touchedCouriers.add(newCourierId);

      this.courierGateway.notifyCourier(newCourierId, order.id);
    }

    for (const courierId of touchedCouriers) {
      await this.routingService.invalidateCourierRoute(courierId);
    }

    this.logger.log(
      `Rebalance summary: orders=${orders.length}, couriers=${couriers.length}, ` +
        `reassignments=${result.reassignments.length}, ` +
        `totalCost ${result.totalCostBefore.toFixed(2)} → ${result.totalCostAfter.toFixed(2)} km`,
    );

    return result;
  }

  private async loadEligibleOrders(): Promise<BatchOrder[]> {
    const rows = await this.db
      .select({
        order: schema.orders,
        org: schema.organizations,
      })
      .from(schema.orders)
      .innerJoin(
        schema.organizations,
        eq(schema.orders.organizationId, schema.organizations.id),
      )
      .where(eq(schema.orders.status, OrderStatus.READY_FOR_DELIVERY));

    const result: BatchOrder[] = [];
    for (const { order, org } of rows) {
      if (
        order.lat == null ||
        order.lng == null ||
        org.lat == null ||
        org.lng == null
      ) {
        continue;
      }
      const orgLat = parseFloat(org.lat);
      const orgLng = parseFloat(org.lng);
      const deliveryLat = parseFloat(order.lat);
      const deliveryLng = parseFloat(order.lng);
      result.push({
        id: order.id,
        organizationId: order.organizationId,
        courierId: order.courierId,
        orgLat,
        orgLng,
        deliveryLat,
        deliveryLng,
        orderIntrinsicKm: haversineKm(
          { id: 0, lat: orgLat, lng: orgLng },
          { id: 0, lat: deliveryLat, lng: deliveryLng },
        ),
      });
    }
    return result;
  }

  private async loadAvailableCouriers(): Promise<BatchCourier[]> {
    const couriers = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, Role.COURIER));

    if (couriers.length === 0) return [];

    const rawActive = await this.db
      .select({
        courierId: schema.orders.courierId,
      })
      .from(schema.orders)
      .where(
        and(
          inArray(
            schema.orders.courierId,
            couriers.map((c) => c.id),
          ),
          inArray(schema.orders.status, [
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.PICKED_UP,
          ]),
        ),
      );

    const workload = new Map<number, number>();
    for (const row of rawActive) {
      if (row.courierId != null) {
        workload.set(row.courierId, (workload.get(row.courierId) ?? 0) + 1);
      }
    }

    const result: BatchCourier[] = [];
    for (const c of couriers) {
      const raw = await this.redisService.get(`courier:location:${c.id}`);
      const activeOrders = workload.get(c.id) ?? 0;
      if (raw) {
        const loc = JSON.parse(raw) as { lat: number; lng: number };
        result.push({
          id: c.id,
          lat: loc.lat,
          lng: loc.lng,
          online: true,
          activeOrders,
        });
      } else if (activeOrders > 0) {
        result.push({
          id: c.id,
          lat: 0,
          lng: 0,
          online: false,
          activeOrders,
        });
      }
    }
    return result;
  }

  private buildCostMatrix(
    orders: BatchOrder[],
    couriers: BatchCourier[],
  ): { matrix: number[][]; slotOwner: number[]; slotIndex: number[] } {
    const slotOwner: number[] = [];
    const slotIndex: number[] = [];
    for (const c of couriers) {
      for (let k = 0; k < COURIER_CAPACITY; k++) {
        slotOwner.push(c.id);
        slotIndex.push(k);
      }
    }

    const matrix: number[][] = orders.map((order) =>
      slotOwner.map((courierId, slotCol) => {
        const courier = couriers.find((c) => c.id === courierId)!;
        return this.pairCost(order, courier, slotIndex[slotCol]);
      }),
    );

    return { matrix, slotOwner, slotIndex };
  }

  private pairCost(
    order: BatchOrder,
    courier: BatchCourier,
    slotIdx: number,
  ): number {
    const approachKm = courier.online
      ? haversineKm(
          { id: 0, lat: courier.lat, lng: courier.lng },
          { id: 0, lat: order.orgLat, lng: order.orgLng },
        )
      : DUMMY_COST / 4;

    const effectiveLoad = courier.activeOrders + slotIdx + 1;
    const loadPenalty = effectiveLoad * effectiveLoad * LOAD_PENALTY_KM;

    return approachKm + order.orderIntrinsicKm + loadPenalty;
  }

  private currentAssignmentCost(
    order: BatchOrder,
    couriers: BatchCourier[],
  ): number {
    if (order.courierId == null) return DUMMY_COST;
    const courier = couriers.find((c) => c.id === order.courierId);
    if (!courier) return DUMMY_COST;
    return this.pairCost(order, courier, 0);
  }

  private padToSquare(matrix: number[][], size: number): number[][] {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const result: number[][] = [];
    for (let i = 0; i < size; i++) {
      const row: number[] = new Array<number>(size).fill(DUMMY_COST);
      if (i < rows) {
        for (let j = 0; j < cols; j++) {
          row[j] = matrix[i][j];
        }
      }
      result.push(row);
    }
    return result;
  }
}
