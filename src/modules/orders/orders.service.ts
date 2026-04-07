import {
  BadRequestException,
  Inject,
  Injectable,
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

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
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
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, dto.courierId));

    if (!courier || courier.role !== Role.COURIER) {
      throw new BadRequestException('User is not a courier');
    }

    const [updated] = await this.db
      .update(schema.orders)
      .set({ courierId: dto.courierId })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  }

  async findCourierOrders(courierId: number) {
    return this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.courierId, courierId),
          eq(schema.orders.status, OrderStatus.READY_FOR_DELIVERY),
        ),
      );
  }
}
