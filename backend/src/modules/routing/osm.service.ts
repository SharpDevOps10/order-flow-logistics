import { Injectable, Logger } from '@nestjs/common';
import { OsmNode, OsmWay } from './dijkstra';

interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Public Overpass API mirrors, tried in order until one succeeds. */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

@Injectable()
export class OsmService {
  private readonly logger = new Logger(OsmService.name);

  /** Padding in degrees added around the delivery area (~3 km). */
  private readonly BBOX_PADDING = 0.03;

  computeBoundingBox(points: { lat: number; lng: number }[]): BoundingBox {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      minLat: Math.min(...lats) - this.BBOX_PADDING,
      minLng: Math.min(...lngs) - this.BBOX_PADDING,
      maxLat: Math.max(...lats) + this.BBOX_PADDING,
      maxLng: Math.max(...lngs) + this.BBOX_PADDING,
    };
  }

  async fetchRoadNetwork(
    bbox: BoundingBox,
  ): Promise<{ nodes: OsmNode[]; ways: OsmWay[] } | null> {
    const { minLat, minLng, maxLat, maxLng } = bbox;

    // Compact query (no whitespace) to stay well under the 2048-byte POST limit
    // enforced by some Overpass mirrors.
    const query =
      `[out:json][timeout:60];` +
      `(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service)$"]` +
      `(${minLat},${minLng},${maxLat},${maxLng});>;);out body;`;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        this.logger.log(`Trying Overpass endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://order-flow-logistics.app/',
            'User-Agent': 'OrderFlowLogistics/1.0 (diploma project)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(65_000),
        });

        if (!response.ok) {
          this.logger.warn(
            `${endpoint} responded with ${response.status} — trying next`,
          );
          continue;
        }

        const data = (await response.json()) as OverpassResponse;

        const nodes: OsmNode[] = data.elements
          .filter(
            (
              e,
            ): e is OverpassElement & {
              type: 'node';
              lat: number;
              lon: number;
            } =>
              e.type === 'node' && e.lat !== undefined && e.lon !== undefined,
          )
          .map((e) => ({ id: e.id, lat: e.lat, lng: e.lon }));

        const ways: OsmWay[] = data.elements
          .filter(
            (e): e is OverpassElement & { type: 'way'; nodes: number[] } =>
              e.type === 'way' && Array.isArray(e.nodes),
          )
          .map((e) => ({
            id: e.id,
            nodes: e.nodes,
            oneway: e.tags?.oneway === 'yes' || e.tags?.oneway === '1',
          }));

        this.logger.log(
          `OSM road network loaded via ${endpoint}: ${nodes.length} nodes, ${ways.length} ways`,
        );

        return { nodes, ways };
      } catch (err) {
        this.logger.warn(`${endpoint} failed: ${(err as Error).message} — trying next`);
      }
    }

    this.logger.error('All Overpass endpoints failed — falling back to Haversine routing');
    return null;
  }
}
