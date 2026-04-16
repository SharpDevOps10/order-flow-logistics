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
  buildOsmGraph,
  dijkstra,
  dijkstraWithPath,
  Edge,
  findNearestNode,
  GraphNode,
  haversineKm,
  optimizeRoute,
  reconstructPath,
} from './dijkstra';
import { OsmService } from './osm.service';

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
  geometry: [number, number][] | null;
}

function orgNodeId(orgId: number): number {
  return -orgId;
}

@Injectable()
export class RoutingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly osmService: OsmService,
  ) {}

  async getOptimizedRoute(courierId: number): Promise<OptimizedRoute[]> {
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

      const allNodes: GraphNode[] = [pickupNode, ...deliveryNodes];
      const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
      const orderDetailsMap = new Map(groupOrders.map((o) => [o.id, o]));

      let orderedLogicalIds: number[];
      let segmentDistancesKm: number[];
      let geometry: [number, number][] | null = null;

      if (osmGraph) {
        const snapToOsm = (lat: number, lng: number) =>
          findNearestNode(osmGraph.nodes, lat, lng).id;

        const snappedPickupId = snapToOsm(pickupNode.lat, pickupNode.lng);
        const snappedDeliveryIds = deliveryNodes.map((n) =>
          snapToOsm(n.lat, n.lng),
        );

        const logicalToOsm = new Map<number, number>();
        const osmToLogical = new Map<number, number>();

        logicalToOsm.set(pickupNode.id, snappedPickupId);
        osmToLogical.set(snappedPickupId, pickupNode.id);

        for (let i = 0; i < deliveryNodes.length; i++) {
          logicalToOsm.set(deliveryNodes[i].id, snappedDeliveryIds[i]);
          osmToLogical.set(snappedDeliveryIds[i], deliveryNodes[i].id);
        }

        const orderedOsmIds = optimizeRoute(
          osmGraph.nodes,
          osmGraph.adj,
          snappedPickupId,
          snappedDeliveryIds,
        );

        orderedLogicalIds = orderedOsmIds.map(
          (osmId) => osmToLogical.get(osmId)!,
        );

        segmentDistancesKm = [0];
        const geomCoords: [number, number][] = [];

        for (let i = 0; i < orderedOsmIds.length - 1; i++) {
          const fromId = orderedOsmIds[i];
          const toId = orderedOsmIds[i + 1];

          const { distances, prev } = dijkstraWithPath(
            osmGraph.nodes,
            osmGraph.adj,
            fromId,
          );

          const roadDist = distances.get(toId) ?? Infinity;
          segmentDistancesKm.push(
            roadDist === Infinity
              ? haversineKm(
                  nodeMap.get(orderedLogicalIds[i])!,
                  nodeMap.get(orderedLogicalIds[i + 1])!,
                )
              : roadDist,
          );

          const path = reconstructPath(prev, toId);
          const startIdx = i === 0 ? 0 : 1;
          for (let j = startIdx; j < path.length; j++) {
            const coord = osmNodeCoordMap.get(path[j]);
            if (coord) geomCoords.push([coord.lat, coord.lng]);
          }
        }

        geometry = geomCoords.length > 1 ? geomCoords : null;
      } else {
        const adj = buildCompleteGraph(allNodes);
        orderedLogicalIds = optimizeRoute(
          allNodes,
          adj,
          pickupNode.id,
          deliveryNodes.map((n) => n.id),
        );

        segmentDistancesKm = [0];
        for (let i = 1; i < orderedLogicalIds.length; i++) {
          const prev = nodeMap.get(orderedLogicalIds[i - 1])!;
          const curr = nodeMap.get(orderedLogicalIds[i])!;
          const dists = dijkstra(allNodes, adj, prev.id);
          segmentDistancesKm.push(
            dists.get(curr.id) ?? haversineKm(prev, curr),
          );
        }
      }

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

    return routes;
  }
}
