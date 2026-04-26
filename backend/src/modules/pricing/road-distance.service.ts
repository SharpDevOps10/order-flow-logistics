import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { haversineKm } from '../routing/dijkstra';

export type DistanceSource = 'osrm' | 'haversine';

export interface RoadDistanceResult {
  km: number;
  durationSec: number | null;
  source: DistanceSource;
}

const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 1500;
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const COORD_PRECISION = 4;

@Injectable()
export class RoadDistanceService {
  private readonly logger = new Logger(RoadDistanceService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('OSRM_BASE_URL') ?? DEFAULT_OSRM_BASE_URL;
  }

  async getDistanceKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): Promise<RoadDistanceResult> {
    const haversine = haversineKm(
      { id: 0, lat: a.lat, lng: a.lng },
      { id: 1, lat: b.lat, lng: b.lng },
    );

    if (haversine < 0.05) {
      return { km: haversine, durationSec: null, source: 'haversine' };
    }

    const key = this.cacheKey(a, b);
    try {
      const cached = await this.redisService.get(key);
      if (cached !== null) {
        const parsed = this.parseCached(cached);
        if (parsed) {
          return { km: parsed.km, durationSec: parsed.durationSec, source: 'osrm' };
        }
      }
    } catch (err) {
      this.logger.warn(
        `Redis read failed for ${key}: ${(err as Error).message}`,
      );
    }

    const osrm = await this.queryOsrm(a, b);
    if (osrm !== null) {
      try {
        await this.redisService.set(
          key,
          `${osrm.km.toFixed(3)}|${Math.round(osrm.durationSec)}`,
          CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          `Redis write failed for ${key}: ${(err as Error).message}`,
        );
      }
      return { km: osrm.km, durationSec: osrm.durationSec, source: 'osrm' };
    }

    this.logger.warn(
      `OSRM unavailable for ${key} — falling back to Haversine (${haversine.toFixed(2)} km)`,
    );
    return { km: haversine, durationSec: null, source: 'haversine' };
  }

  private parseCached(
    raw: string,
  ): { km: number; durationSec: number | null } | null {
    if (raw.includes('|')) {
      const [kmStr, durStr] = raw.split('|');
      const km = Number(kmStr);
      const durationSec = Number(durStr);
      if (!Number.isFinite(km)) return null;
      return {
        km,
        durationSec: Number.isFinite(durationSec) ? durationSec : null,
      };
    }
    const km = Number(raw);
    if (!Number.isFinite(km)) return null;
    return { km, durationSec: null };
  }

  private cacheKey(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): string {
    const round = (v: number) => v.toFixed(COORD_PRECISION);
    const [p1, p2] = [
      `${round(a.lat)},${round(a.lng)}`,
      `${round(b.lat)},${round(b.lng)}`,
    ].sort();
    return `osrm:dist:${p1}:${p2}`;
  }

  private async queryOsrm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): Promise<{ km: number; durationSec: number } | null> {
    const url =
      `${this.baseUrl}/route/v1/driving/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
        headers: { 'User-Agent': 'OrderFlowLogistics/1.0' },
      });
      if (!response.ok) {
        this.logger.warn(`OSRM responded ${response.status}`);
        return null;
      }
      const data = (await response.json()) as {
        code?: string;
        routes?: { distance: number; duration: number }[];
      };
      if (data.code !== 'Ok' || !data.routes?.length) {
        this.logger.warn(`OSRM returned no route (code=${data.code})`);
        return null;
      }
      const route = data.routes[0];
      if (!Number.isFinite(route.distance) || route.distance < 0) return null;
      if (!Number.isFinite(route.duration) || route.duration < 0) return null;
      return { km: route.distance / 1000, durationSec: route.duration };
    } catch (err) {
      this.logger.warn(`OSRM request failed: ${(err as Error).message}`);
      return null;
    }
  }
}
