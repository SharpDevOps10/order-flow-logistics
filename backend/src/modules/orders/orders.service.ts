import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { CreateOrderDto } from './dtos/create-order.dto';
import { UpdateOrderStatusDto } from './dtos/update-order-status.dto';
import { AssignCourierDto } from './dtos/assign-courier.dto';
import {
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
} from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import { MailService } from '../mail/mail.service';
import { OrderReadyEvent } from '../courier-assignment/courier-assignment.service';
import { RoutingService } from '../routing/routing.service';
import { OrderEventsPublisher } from '../messaging/order-events.publisher';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly mailService: MailService,
    private readonly orderEventsPublisher: OrderEventsPublisher,
    private readonly routingService: RoutingService,
  ) {}

  async create(dto: CreateOrderDto, clientId: number) {
    const productIds = dto.items.map((item) => item.productId);

    const products = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          inArray(schema.products.id, productIds),
          eq(schema.products.organizationId, dto.organizationId),
        ),
      );

    if (products.length !== productIds.length) {
      throw new UnprocessableEntityException(
        'Some products do not exist or do not belong to this organization',
      );
    }

    const priceMap = new Map(products.map((p) => [p.id, p.price]));

    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + priceMap.get(item.productId)! * item.quantity;
    }, 0);

    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(schema.orders)
        .values({
          clientId,
          organizationId: dto.organizationId,
          deliveryAddress: dto.deliveryAddress,
          lat: dto.lat,
          lng: dto.lng,
          totalAmount,
        })
        .returning();

      const itemsToInsert = dto.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: priceMap.get(item.productId)!,
      }));

      const items = await tx
        .insert(schema.orderItems)
        .values(itemsToInsert)
        .returning();

      return { ...order, items };
    });
  }

  async findMyOrders(clientId: number) {
    return this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.clientId, clientId));
  }

  async findSupplierOrders(supplierId: number) {
    const supplierOrgs = await this.db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.ownerId, supplierId));

    if (supplierOrgs.length === 0) return [];

    const orgIds = supplierOrgs.map((o) => o.id);

    return this.db
      .select()
      .from(schema.orders)
      .where(inArray(schema.orders.organizationId, orgIds));
  }

  async updateStatus(
    orderId: number,
    supplierId: number,
    dto: UpdateOrderStatusDto,
  ) {
    const [row] = await this.db
      .select()
      .from(schema.orders)
      .innerJoin(
        schema.organizations,
        eq(schema.orders.organizationId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.organizations.ownerId, supplierId),
        ),
      );

    if (!row) {
      throw new NotFoundException('Order not found or access denied');
    }

    const currentStatus = row.orders.status as OrderStatus;
    const allowedNext = ORDER_STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${dto.status}`,
      );
    }

    const [updated] = await this.db
      .update(schema.orders)
      .set({ status: dto.status })
      .where(eq(schema.orders.id, orderId))
      .returning();

    // Any status change affects whether this order appears in the courier's
    // optimised route (only READY_FOR_DELIVERY orders are included).
    if (updated.courierId) {
      await this.routingService.invalidateCourierRoute(updated.courierId);
    }

    if (dto.status === OrderStatus.READY_FOR_DELIVERY) {
      const org = row.organizations;
      if (org.lat && org.lng) {
        const event: OrderReadyEvent = {
          orderId: updated.id,
          organizationId: org.id,
          orgLat: parseFloat(org.lat),
          orgLng: parseFloat(org.lng),
          orgName: org.name,
          deliveryAddress: updated.deliveryAddress,
          totalAmount: updated.totalAmount,
        };
        this.orderEventsPublisher.publishReadyForDelivery(event);
      } else {
        this.logger.warn(
          `Organization #${org.id} has no coordinates — skipping auto-assignment for order #${updated.id}`,
        );
      }
    }

    return updated;
  }

  async assignCourier(
    orderId: number,
    supplierId: number,
    dto: AssignCourierDto,
  ) {
    const [row] = await this.db
      .select()
      .from(schema.orders)
      .innerJoin(
        schema.organizations,
        eq(schema.orders.organizationId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.organizations.ownerId, supplierId),
        ),
      );

    if (!row) {
      throw new NotFoundException('Order not found or access denied');
    }

    if (row.orders.status !== OrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException(
        'Courier can only be assigned to orders with status READY_FOR_DELIVERY',
      );
    }

    const [courier] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, dto.courierId));

    if (!courier || courier.role !== Role.COURIER) {
      throw new BadRequestException('User is not a courier');
    }

    // Get order items count
    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    const previousCourierId = row.orders.courierId;

    const [updated] = await this.db
      .update(schema.orders)
      .set({ courierId: dto.courierId })
      .where(eq(schema.orders.id, orderId))
      .returning();

    // Invalidate the new courier's route cache, and the previous one if
    // this is a reassignment, so both get fresh data next request.
    await this.routingService.invalidateCourierRoute(dto.courierId);
    if (previousCourierId && previousCourierId !== dto.courierId) {
      await this.routingService.invalidateCourierRoute(previousCourierId);
    }

    // Send email to courier
    try {
      await this.mailService.sendCourierAssigned(
        courier.email,
        courier.fullName || 'Courier',
        orderId,
        row.organizations.name,
        row.orders.deliveryAddress,
        row.orders.totalAmount,
        items.length,
      );
    } catch (error) {
      // Log error but don't fail the order assignment
      console.error('Failed to send courier assignment email:', error);
    }

    return updated;
  }

  async cancel(orderId: number, clientId: number) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.clientId, clientId),
        ),
      );

    if (!order) {
      throw new NotFoundException('Order not found or access denied');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId));
      await tx.delete(schema.orders).where(eq(schema.orders.id, orderId));
    });

    return order;
  }

  async findCourierOrders(courierId: number) {
    // Active work = not yet delivered. Includes PICKED_UP so courier can
    // track in-progress deliveries.
    return this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.courierId, courierId),
          inArray(schema.orders.status, [
            OrderStatus.READY_FOR_DELIVERY,
            OrderStatus.PICKED_UP,
          ]),
        ),
      );
  }

  /**
   * Courier marks an order as picked up from the supplier.
   * Once in PICKED_UP status, the batch rebalancer will not touch the order.
   */
  async markPickedUp(orderId: number, courierId: number) {
    return this.transitionCourierStatus(
      orderId,
      courierId,
      OrderStatus.READY_FOR_DELIVERY,
      OrderStatus.PICKED_UP,
    );
  }

  /** Courier confirms successful delivery. */
  async markDelivered(orderId: number, courierId: number) {
    return this.transitionCourierStatus(
      orderId,
      courierId,
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
    );
  }

  private async transitionCourierStatus(
    orderId: number,
    courierId: number,
    from: OrderStatus,
    to: OrderStatus,
  ) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order || order.courierId !== courierId) {
      throw new NotFoundException('Order not found or not assigned to you');
    }
    if (order.status !== from) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${to}`,
      );
    }

    const [updated] = await this.db
      .update(schema.orders)
      .set({ status: to })
      .where(eq(schema.orders.id, orderId))
      .returning();

    await this.routingService.invalidateCourierRoute(courierId);

    return updated;
  }
}
