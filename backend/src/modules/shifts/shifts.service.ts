import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { SetShiftsDto, ShiftSlotDto } from './dtos/set-shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getMyShifts(courierId: number) {
    return this.db
      .select()
      .from(schema.courierShifts)
      .where(eq(schema.courierShifts.courierId, courierId));
  }

  async setMyShifts(courierId: number, dto: SetShiftsDto) {
    this.validateSlots(dto.slots);

    return this.db.transaction(async (tx) => {
      await tx
        .delete(schema.courierShifts)
        .where(eq(schema.courierShifts.courierId, courierId));

      if (dto.slots.length === 0) return [];

      return tx
        .insert(schema.courierShifts)
        .values(
          dto.slots.map((s) => ({
            courierId,
            dayOfWeek: s.dayOfWeek,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        )
        .returning();
    });
  }

  /**
   * Returns the subset of courierIds who are on shift at the given moment.
   * Couriers with no shifts configured are treated as always available.
   */
  async filterOnShiftCouriers(
    courierIds: number[],
    when: Date,
  ): Promise<number[]> {
    if (courierIds.length === 0) return [];

    const dayOfWeek = when.getDay();
    const minuteOfDay = when.getHours() * 60 + when.getMinutes();

    const rows = await this.db
      .select({
        courierId: schema.courierShifts.courierId,
        dayOfWeek: schema.courierShifts.dayOfWeek,
        startMinute: schema.courierShifts.startMinute,
        endMinute: schema.courierShifts.endMinute,
      })
      .from(schema.courierShifts)
      .where(inArray(schema.courierShifts.courierId, courierIds));

    const hasAnyShifts = new Set<number>(rows.map((r) => r.courierId));
    const onShift = new Set<number>();
    for (const r of rows) {
      if (
        r.dayOfWeek === dayOfWeek &&
        minuteOfDay >= r.startMinute &&
        minuteOfDay < r.endMinute
      ) {
        onShift.add(r.courierId);
      }
    }

    return courierIds.filter(
      (id) => !hasAnyShifts.has(id) || onShift.has(id),
    );
  }

  private validateSlots(slots: ShiftSlotDto[]): void {
    for (const s of slots) {
      if (s.startMinute >= s.endMinute) {
        throw new BadRequestException(
          `Slot on day ${s.dayOfWeek} has start >= end (cross-midnight not allowed)`,
        );
      }
    }

    const byDay = new Map<number, ShiftSlotDto[]>();
    for (const s of slots) {
      const list = byDay.get(s.dayOfWeek) ?? [];
      list.push(s);
      byDay.set(s.dayOfWeek, list);
    }

    for (const [day, list] of byDay) {
      const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].startMinute < sorted[i - 1].endMinute) {
          throw new BadRequestException(
            `Overlapping slots on day ${day}`,
          );
        }
      }
    }
  }
}
