import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { CreateReviewDto } from './dtos/create-review.dto';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { BAYESIAN_PRIOR_WEIGHT, bayesianAverage } from './bayesian';

const DEFAULT_GLOBAL_MEAN = 4.0;

export interface CourierRatingStats {
  count: number;
  averageCourier: number | null;
  averageSpeed: number | null;
  bayesianCourier: number;
  bayesianSpeed: number;
  globalMean: number;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateReviewDto, clientId: number) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, dto.orderId));
    if (!order) throw new NotFoundException('Order not found');
    if (order.clientId !== clientId)
      throw new ForbiddenException('You can only review your own orders');
    if (order.status !== OrderStatus.DELIVERED)
      throw new BadRequestException('Only delivered orders can be reviewed');
    if (!order.courierId)
      throw new BadRequestException('Order has no courier to review');

    const [existing] = await this.db
      .select()
      .from(schema.orderReviews)
      .where(eq(schema.orderReviews.orderId, dto.orderId));
    if (existing) throw new BadRequestException('Review already submitted');

    const [review] = await this.db
      .insert(schema.orderReviews)
      .values({
        orderId: dto.orderId,
        clientId,
        courierId: order.courierId,
        courierRating: dto.courierRating,
        speedRating: dto.speedRating,
        comment: dto.comment,
      })
      .returning();

    return review;
  }

  async findByOrder(orderId: number) {
    const [review] = await this.db
      .select()
      .from(schema.orderReviews)
      .where(eq(schema.orderReviews.orderId, orderId));
    return review ?? null;
  }

  async getCourierStats(courierId: number): Promise<CourierRatingStats> {
    const globalMean = await this.getGlobalMean();

    const [row] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        sumCourier: sql<number>`coalesce(sum(${schema.orderReviews.courierRating}), 0)::int`,
        sumSpeed: sql<number>`coalesce(sum(${schema.orderReviews.speedRating}), 0)::int`,
      })
      .from(schema.orderReviews)
      .where(eq(schema.orderReviews.courierId, courierId));

    const count = Number(row?.count ?? 0);
    const sumCourier = Number(row?.sumCourier ?? 0);
    const sumSpeed = Number(row?.sumSpeed ?? 0);

    return {
      count,
      averageCourier: count > 0 ? sumCourier / count : null,
      averageSpeed: count > 0 ? sumSpeed / count : null,
      bayesianCourier: bayesianAverage(
        sumCourier,
        count,
        globalMean,
        BAYESIAN_PRIOR_WEIGHT,
      ),
      bayesianSpeed: bayesianAverage(
        sumSpeed,
        count,
        globalMean,
        BAYESIAN_PRIOR_WEIGHT,
      ),
      globalMean,
    };
  }

  /**
   * Bulk lookup: returns Bayesian-weighted courier rating for each courierId.
   * Used by assignment to score multiple couriers in one trip to the DB.
   */
  async getBayesianRatingsForCouriers(
    courierIds: number[],
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (courierIds.length === 0) return result;

    const globalMean = await this.getGlobalMean();

    const rows = await this.db
      .select({
        courierId: schema.orderReviews.courierId,
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${schema.orderReviews.courierRating}), 0)::int`,
      })
      .from(schema.orderReviews)
      .where(inArray(schema.orderReviews.courierId, courierIds))
      .groupBy(schema.orderReviews.courierId);

    const stats = new Map(
      rows.map((r) => [Number(r.courierId), { count: Number(r.count), sum: Number(r.sum) }]),
    );

    for (const id of courierIds) {
      const s = stats.get(id);
      const sum = s?.sum ?? 0;
      const count = s?.count ?? 0;
      result.set(
        id,
        bayesianAverage(sum, count, globalMean, BAYESIAN_PRIOR_WEIGHT),
      );
    }

    return result;
  }

  private async getGlobalMean(): Promise<number> {
    const [row] = await this.db
      .select({
        avg: sql<string | null>`avg(${schema.orderReviews.courierRating})`,
      })
      .from(schema.orderReviews);
    const avg = row?.avg !== null && row?.avg !== undefined ? Number(row.avg) : null;
    return avg !== null && !Number.isNaN(avg) ? avg : DEFAULT_GLOBAL_MEAN;
  }
}
