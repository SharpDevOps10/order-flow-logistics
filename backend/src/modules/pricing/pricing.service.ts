import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import { ShiftsService } from '../shifts/shifts.service';
import { PRICING_CONFIG } from './pricing.config';
import type { DistanceSource } from './road-distance.service';

export interface PricingBreakdownItem {
  label: string;
  amount: number;
  detail?: string;
}

export interface PricingBreakdown {
  distanceKm: number;
  distanceSource: DistanceSource;
  base: number;
  distanceFee: number;
  rushMultiplier: number;
  rushLabel: string | null;
  loadMultiplier: number;
  systemLoadRatio: number;
  activeOrders: number;
  availableCouriers: number;
  subtotal: number;
  afterRush: number;
  finalFee: number;
  items: PricingBreakdownItem[];
}

export interface QuoteParams {
  distanceKm: number;
  at?: Date;
  distanceSource?: DistanceSource;
}

@Injectable()
export class PricingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly shiftsService: ShiftsService,
  ) {}

  async quote(params: QuoteParams): Promise<PricingBreakdown> {
    const at = params.at ?? new Date();
    const distanceKm = Math.max(0, Number(params.distanceKm.toFixed(2)));

    const base = PRICING_CONFIG.base;
    const distanceFee = Math.round(PRICING_CONFIG.perKm * distanceKm);
    const subtotal = base + distanceFee;

    const rush = this.getRushMultiplier(at);
    const afterRush = subtotal * rush.multiplier;

    const load = await this.getLoadMultiplier();
    const final = this.clamp(
      Math.round(afterRush * load.multiplier),
      PRICING_CONFIG.minFee,
      PRICING_CONFIG.maxFee,
    );

    const items: PricingBreakdownItem[] = [
      { label: 'Base fee', amount: base },
      {
        label: 'Distance',
        amount: distanceFee,
        detail:
          `${distanceKm.toFixed(2)} km × ${PRICING_CONFIG.perKm} ₴/km` +
          ` (${params.distanceSource ?? 'haversine'})`,
      },
    ];
    if (rush.multiplier !== 1) {
      items.push({
        label: rush.label ?? 'Rush hour',
        amount: Math.round(afterRush - subtotal),
        detail: `×${rush.multiplier.toFixed(2)}`,
      });
    }
    if (load.multiplier !== 1) {
      items.push({
        label: 'High demand surge',
        amount: Math.round(final - afterRush),
        detail: `×${load.multiplier.toFixed(2)} (${load.activeOrders} orders / ${load.availableCouriers} couriers)`,
      });
    }

    return {
      distanceKm,
      distanceSource: params.distanceSource ?? 'haversine',
      base,
      distanceFee,
      rushMultiplier: rush.multiplier,
      rushLabel: rush.label,
      loadMultiplier: load.multiplier,
      systemLoadRatio: load.ratio,
      activeOrders: load.activeOrders,
      availableCouriers: load.availableCouriers,
      subtotal,
      afterRush: Math.round(afterRush),
      finalFee: final,
      items,
    };
  }

  private getRushMultiplier(at: Date): {
    multiplier: number;
    label: string | null;
  } {
    const hour = at.getHours();
    for (const w of PRICING_CONFIG.rushHours) {
      if (hour >= w.from && hour < w.to) {
        return { multiplier: w.multiplier, label: w.label };
      }
    }
    return { multiplier: 1, label: null };
  }

  private async getLoadMultiplier(): Promise<{
    multiplier: number;
    ratio: number;
    activeOrders: number;
    availableCouriers: number;
  }> {
    const [activeRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(
        inArray(schema.orders.status, [
          OrderStatus.PENDING,
          OrderStatus.ACCEPTED,
          OrderStatus.READY_FOR_DELIVERY,
          OrderStatus.PICKED_UP,
        ]),
      );
    const activeOrders = Number(activeRow?.count ?? 0);

    const couriers = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, Role.COURIER));
    const onShift = await this.shiftsService.filterOnShiftCouriers(
      couriers.map((c) => c.id),
      new Date(),
    );
    const availableCouriers = onShift.length;

    if (availableCouriers === 0) {
      return {
        multiplier: PRICING_CONFIG.load.maxMultiplier,
        ratio: Infinity,
        activeOrders,
        availableCouriers: 0,
      };
    }

    const ratio = activeOrders / availableCouriers;
    const cfg = PRICING_CONFIG.load;
    const raw = 1 + Math.max(0, ratio - cfg.triggerRatio) * cfg.perRatioPoint;
    const multiplier = Math.min(raw, cfg.maxMultiplier);
    return {
      multiplier: Math.round(multiplier * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      activeOrders,
      availableCouriers,
    };
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }
}
