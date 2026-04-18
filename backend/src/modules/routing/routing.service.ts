import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { OrderStatus } from '../../common/enums/order-status.enum';
import {
  buildHaversineMatrix,
  buildOsmGraph,
  computeOsmDistanceMatrix,
  DistanceMatrix,
  Edge,
  findNearestNode,
  GraphNode,
} from './dijkstra';
import { solveTSP } from './tsp-solvers';
import { OsmService } from './osm.service';
import { RedisService } from '../redis/redis.service';

export const routeCacheKey = (courierId: number) =>
  `route:courier:${courierId}`;
const ROUTE_CACHE_TTL_SECONDS = 60 * 60;

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
  geometry: [number, number][][] | null;
}

function orgNodeId(orgId: number): number {
  return -orgId;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly osmService: OsmService,
    private readonly redisService: RedisService,
  ) {}

  async invalidateCourierRoute(courierId: number): Promise<void> {
    try {
      await this.redisService.del(routeCacheKey(courierId));
      this.logger.log(`Route cache invalidated for courier #${courierId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate route cache for courier #${courierId}: ${(err as Error).message}`,
      );
    }
  }

  async getOptimizedRoute(courierId: number): Promise<OptimizedRoute[]> {
    const key = routeCacheKey(courierId);

    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        this.logger.log(`Route cache HIT for courier #${courierId}`);
        return JSON.parse(cached) as OptimizedRoute[];
      }
    } catch (err) {
      this.logger.warn(
        `Route cache read failed for courier #${courierId}: ${(err as Error).message}`,
      );
    }

    this.logger.log(`Route cache MISS for courier #${courierId} — computing`);

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

    const ordersWithoutCoords = orders.filter(
      (o) => o.lat === null || o.lng === null,
    );
    if (ordersWithoutCoords.length > 0) {
      throw new BadRequestException(
        `Orders missing delivery coordinates: ${ordersWithoutCoords.map((o) => o.id).join(', ')}`,
      );
    }

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

    const allPoints = [
      ...orders.map((o) => ({
        lat: parseFloat(o.lat!),
        lng: parseFloat(o.lng!),
      })),
      ...orgs.map((o) => ({
        lat: parseFloat(o.lat!),
        lng: parseFloat(o.lng!),
      })),
    ];

    const bbox = this.osmService.computeBoundingBox(allPoints);
    const osmNetwork = await this.osmService.fetchRoadNetwork(bbox);

    let osmGraph: { nodes: GraphNode[]; adj: Map<number, Edge[]> } | null =
      null;
    const osmNodeCoordMap = new Map<number, { lat: number; lng: number }>();

    if (osmNetwork && osmNetwork.nodes.length > 0) {
      osmGraph = buildOsmGraph(osmNetwork.nodes, osmNetwork.ways);
      for (const n of osmNetwork.nodes) {
        osmNodeCoordMap.set(n.id, { lat: n.lat, lng: n.lng });
      }
    }

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

      const waypointNodes: GraphNode[] = [pickupNode, ...deliveryNodes];
      const orderDetailsMap = new Map(groupOrders.map((o) => [o.id, o]));

      // 1. Build N×N distance matrix (OSM-based if available, Haversine otherwise)
      //    plus per-pair OSM paths for later geometry rendering.
      let matrix: DistanceMatrix;
      let snappedOsmIds: number[] | null = null;

      if (osmGraph) {
        snappedOsmIds = waypointNodes.map(
          (wp) => findNearestNode(osmGraph.nodes, wp.lat, wp.lng).id,
        );
        matrix = computeOsmDistanceMatrix(
          osmGraph.nodes,
          osmGraph.adj,
          snappedOsmIds,
        );
      } else {
        matrix = buildHaversineMatrix(waypointNodes);
      }

      // 2. Solve the TSP on the matrix (Held-Karp for small n, greedy+2-opt above).
      const tsp = solveTSP(matrix.distances, 0);
      this.logger.log(
        `TSP solved for org #${orgId} (n=${waypointNodes.length}, solver=${tsp.solver}): ${tsp.totalDistance.toFixed(2)} km` +
          (tsp.greedyDistance !== undefined
            ? ` (greedy=${tsp.greedyDistance.toFixed(2)} km, improvement=${(100 * (1 - tsp.totalDistance / tsp.greedyDistance)).toFixed(1)}%)`
            : ''),
      );

      // 3. Map TSP indices back to logical node ids and precomputed distances.
      const orderedLogicalIds = tsp.route.map((idx) => waypointNodes[idx].id);
      const segmentDistancesKm: number[] = [0];
      for (let i = 1; i < tsp.route.length; i++) {
        segmentDistancesKm.push(
          matrix.distances[tsp.route[i - 1]][tsp.route[i]],
        );
      }

      // 4. Build per-segment geometry from the precomputed paths.
      let geometry: [number, number][][] | null = null;
      if (matrix.paths) {
        const segments: [number, number][][] = [];
        for (let i = 0; i < tsp.route.length - 1; i++) {
          const path = matrix.paths[tsp.route[i]][tsp.route[i + 1]];
          const coords: [number, number][] = [];
          for (const nodeId of path) {
            const c = osmNodeCoordMap.get(nodeId);
            if (c) coords.push([c.lat, c.lng]);
          }
          if (coords.length > 1) segments.push(coords);
        }
        geometry = segments.length > 0 ? segments : null;
      }

      const nodeMap = new Map(waypointNodes.map((n) => [n.id, n]));

      const waypoints: RoutePoint[] = [];
      let totalDistanceKm = 0;

      for (let i = 0; i < orderedLogicalIds.length; i++) {
        const nodeId = orderedLogicalIds[i];
        const node = nodeMap.get(nodeId)!;
        const distFromPrev = segmentDistancesKm[i];
        totalDistanceKm += distFromPrev;

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
        geometry,
      });
    }

    try {
      await this.redisService.set(
        key,
        JSON.stringify(routes),
        ROUTE_CACHE_TTL_SECONDS,
      );
      this.logger.log(
        `Route cached for courier #${courierId} (${routes.length} route(s), TTL ${ROUTE_CACHE_TTL_SECONDS}s)`,
      );
    } catch (err) {
      this.logger.warn(
        `Route cache write failed for courier #${courierId}: ${(err as Error).message}`,
      );
    }

    return routes;
  }
}
