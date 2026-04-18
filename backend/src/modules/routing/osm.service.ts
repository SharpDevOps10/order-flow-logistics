import { Injectable, Logger } from '@nestjs/common';
import { OsmNode, OsmWay } from './dijkstra';
import { RedisService } from '../redis/redis.service';

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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

@Injectable()
export class OsmService {
  private readonly logger = new Logger(OsmService.name);

  private readonly BBOX_PADDING = 0.03;
  private readonly CACHE_GRID = 0.05;
  private readonly CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

  constructor(private readonly redisService: RedisService) {}

  computeBoundingBox(points: { lat: number; lng: number }[]): BoundingBox {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats) - this.BBOX_PADDING;
    const maxLat = Math.max(...lats) + this.BBOX_PADDING;
    const minLng = Math.min(...lngs) - this.BBOX_PADDING;
    const maxLng = Math.max(...lngs) + this.BBOX_PADDING;

    const g = this.CACHE_GRID;
    return {
      minLat: Math.floor(minLat / g) * g,
      minLng: Math.floor(minLng / g) * g,
      maxLat: Math.ceil(maxLat / g) * g,
      maxLng: Math.ceil(maxLng / g) * g,
    };
  }

  private cacheKey(bbox: BoundingBox): string {
    const f = (n: number) => n.toFixed(2);
    return `osm:${f(bbox.minLat)},${f(bbox.minLng)},${f(bbox.maxLat)},${f(bbox.maxLng)}`;
  }

  async fetchRoadNetwork(
    bbox: BoundingBox,
  ): Promise<{ nodes: OsmNode[]; ways: OsmWay[] } | null> {
    const key = this.cacheKey(bbox);

    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          nodes: OsmNode[];
          ways: OsmWay[];
        };
        this.logger.log(
          `OSM cache HIT for ${key}: ${parsed.nodes.length} nodes, ${parsed.ways.length} ways`,
        );
        return parsed;
      }
    } catch (err) {
      this.logger.warn(
        `Redis read failed for ${key}: ${(err as Error).message}`,
      );
    }

    this.logger.log(`OSM cache MISS for ${key} — querying Overpass`);

    const { minLat, minLng, maxLat, maxLng } = bbox;

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
            Referer: 'https://order-flow-logistics.app/',
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

        try {
          await this.redisService.set(
            key,
            JSON.stringify({ nodes, ways }),
            this.CACHE_TTL_SECONDS,
          );
          this.logger.log(
            `OSM cached under ${key} for ${this.CACHE_TTL_SECONDS}s`,
          );
        } catch (err) {
          this.logger.warn(
            `Redis write failed for ${key}: ${(err as Error).message}`,
          );
        }

        return { nodes, ways };
      } catch (err) {
        this.logger.warn(
          `${endpoint} failed: ${(err as Error).message} — trying next`,
        );
      }
    }

    this.logger.error(
      'All Overpass endpoints failed — falling back to Haversine routing',
    );
    return null;
  }
}
