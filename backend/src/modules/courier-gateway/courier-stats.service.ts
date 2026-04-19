import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { haversineKm } from '../routing/dijkstra';

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const MIN_SAMPLES_FOR_REAL_AVG = 5;
const FALLBACK_SPEED_KMH = 25;
const MIN_ALLOWED_SPEED_KMH = 12;
const MAX_ALLOWED_SPEED_KMH = 120;
const MIN_DT_SECONDS = 5;
const MAX_DT_SECONDS = 10 * 60;

interface LocationSample {
  lat: number;
  lng: number;
  t: number;
}

export interface CourierSpeedStats {
  avgSpeedKmh: number;
  sampleCount: number;
  windowMinutes: number;
  isFallback: boolean;
}

@Injectable()
export class CourierStatsService {
  private readonly logger = new Logger(CourierStatsService.name);

  constructor(private readonly redisService: RedisService) {}

  async getAverageSpeed(
    courierId: number,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): Promise<CourierSpeedStats> {
    const now = Date.now();
    const from = now - windowMs;
    const key = `courier:location:history:${courierId}`;

    const raw = await this.redisService.zrangeByScore(key, from, now);
    const samples = this.parseSamples(raw);

    const speeds: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const dtSeconds = (curr.t - prev.t) / 1000;
      if (dtSeconds < MIN_DT_SECONDS || dtSeconds > MAX_DT_SECONDS) continue;

      const distKm = haversineKm(
        { id: 0, lat: prev.lat, lng: prev.lng },
        { id: 0, lat: curr.lat, lng: curr.lng },
      );
      const speedKmh = distKm / (dtSeconds / 3600);
      if (speedKmh < 1 || speedKmh > MAX_ALLOWED_SPEED_KMH) continue;

      speeds.push(speedKmh);
    }

    if (speeds.length < MIN_SAMPLES_FOR_REAL_AVG) {
      return {
        avgSpeedKmh: FALLBACK_SPEED_KMH,
        sampleCount: speeds.length,
        windowMinutes: Math.round(windowMs / 60000),
        isFallback: true,
      };
    }

    const avg = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    const clamped = Math.max(
      MIN_ALLOWED_SPEED_KMH,
      Math.min(MAX_ALLOWED_SPEED_KMH, avg),
    );

    return {
      avgSpeedKmh: Math.round(clamped * 10) / 10,
      sampleCount: speeds.length,
      windowMinutes: Math.round(windowMs / 60000),
      isFallback: false,
    };
  }

  private parseSamples(raw: string[]): LocationSample[] {
    const samples: LocationSample[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      try {
        const payload = JSON.parse(raw[i]) as LocationSample;
        if (
          typeof payload.lat === 'number' &&
          typeof payload.lng === 'number' &&
          typeof payload.t === 'number'
        ) {
          samples.push(payload);
        }
      } catch {
        continue;
      }
    }
    samples.sort((a, b) => a.t - b.t);
    return samples;
  }
}
