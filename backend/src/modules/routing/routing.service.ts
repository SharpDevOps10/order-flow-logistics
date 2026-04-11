import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { OrderStatus } from '../../common/enums/order-status.enum';
import {
  buildCompleteGraph,
  dijkstra,
  GraphNode,
  haversineKm,
  optimizeRoute,
} from './dijkstra';

export interface RoutePoint {
  type: 'PICKUP' | 'DELIVERY';
  orderId: number | null;
  organizationId: number | null;
  address: string;
  lat: number;
  lng: number;
  distanceFromPrevKm: number;
}

export interface OptimizedRoute {
  totalDistanceKm: number;
  waypoints: RoutePoint[];
}

/** Negative IDs are used for organisation pickup nodes to avoid collisions with order IDs. */
function orgNodeId(orgId: number): number {
  return -orgId;
}

@Injectable()
export class RoutingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
  ) {}

  async getOptimizedRoute(courierId: number): Promise<OptimizedRoute[]> {
    // 1. Get all READY_FOR_DELIVERY orders assigned to this courier.
    const orders = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.courierId, courierId),
          eq(schema.orders.status, OrderStatus.READY_FOR_DELIVERY),
        ),
      );

    if (orders.length === 0) {
      throw new NotFoundException(
        'No READY_FOR_DELIVERY orders assigned to this courier',
      );
    }

    // Validate that every order has delivery coordinates.
    const ordersWithoutCoords = orders.filter(
      (o) => o.lat === null || o.lng === null,
    );
    if (ordersWithoutCoords.length > 0) {
      throw new BadRequestException(
        `Orders missing delivery coordinates: ${ordersWithoutCoords.map((o) => o.id).join(', ')}`,
      );
    }

    // 2. Group orders by organisation (each org is a separate pickup point).
    const orgIds = [...new Set(orders.map((o) => o.organizationId))];

    const orgs = await this.db
      .select()
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, orgIds));

    const orgsWithoutCoords = orgs.filter(
      (o) => o.lat === null || o.lng === null,
    );
    if (orgsWithoutCoords.length > 0) {
      throw new BadRequestException(
        `Organisations missing pickup coordinates: ${orgsWithoutCoords.map((o) => o.id).join(', ')}`,
      );
    }

    const orgMap = new Map(orgs.map((o) => [o.id, o]));

    // 3. Build an optimised route per organisation group.
    const routes: OptimizedRoute[] = [];

    for (const orgId of orgIds) {
      const org = orgMap.get(orgId)!;
      const groupOrders = orders.filter((o) => o.organizationId === orgId);

      const pickupNode: GraphNode = {
        id: orgNodeId(orgId),
        lat: parseFloat(org.lat!),
        lng: parseFloat(org.lng!),
      };

      const deliveryNodes: GraphNode[] = groupOrders.map((o) => ({
        id: o.id,
        lat: parseFloat(o.lat!),
        lng: parseFloat(o.lng!),
      }));

      const allNodes: GraphNode[] = [pickupNode, ...deliveryNodes];
      const adj = buildCompleteGraph(allNodes);

      const orderedIds = optimizeRoute(
        allNodes,
        adj,
        pickupNode.id,
        deliveryNodes.map((n) => n.id),
      );

      // 4. Build waypoints from the ordered node IDs.
      const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
      const orderDetailsMap = new Map(groupOrders.map((o) => [o.id, o]));

      const waypoints: RoutePoint[] = [];
      let totalDistanceKm = 0;

      for (let i = 0; i < orderedIds.length; i++) {
        const nodeId = orderedIds[i];
        const node = nodeMap.get(nodeId)!;

        let distFromPrev = 0;
        if (i > 0) {
          const prevNode = nodeMap.get(orderedIds[i - 1])!;
          // Re-run Dijkstra from previous node to get exact shortest distance.
          const dists = dijkstra(allNodes, adj, prevNode.id);
          distFromPrev = dists.get(nodeId) ?? haversineKm(prevNode, node);
          totalDistanceKm += distFromPrev;
        }

        if (nodeId === pickupNode.id) {
          waypoints.push({
            type: 'PICKUP',
            orderId: null,
            organizationId: orgId,
            address: org.name + (org.region ? `, ${org.region}` : ''),
            lat: node.lat,
            lng: node.lng,
            distanceFromPrevKm: 0,
          });
        } else {
          const order = orderDetailsMap.get(nodeId)!;
          waypoints.push({
            type: 'DELIVERY',
            orderId: order.id,
            organizationId: null,
            address: order.deliveryAddress,
            lat: node.lat,
            lng: node.lng,
            distanceFromPrevKm: Math.round(distFromPrev * 1000) / 1000,
          });
        }
      }

      routes.push({
        totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
        waypoints,
      });
    }

    return routes;
  }
}
