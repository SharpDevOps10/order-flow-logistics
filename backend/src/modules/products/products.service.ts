import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateProductDto, organizationId: number) {
    const [newProduct] = await this.db
      .insert(schema.products)
      .values({ ...dto, organizationId })
      .returning();

    return newProduct;
  }

  async findByOrganization(organizationId: number) {
    return this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.organizationId, organizationId));
  }

  async update(id: number, dto: UpdateProductDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No data provided for update');
    }

    const [updated] = await this.db
      .update(schema.products)
      .set(dto)
      .where(eq(schema.products.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.db
      .delete(schema.products)
      .where(eq(schema.products.id, id))
      .returning();

    if (!deleted) throw new NotFoundException('Product not found');
    return deleted;
  }

  async isOwnedBySupplier(productId: number, userId: number): Promise<boolean> {
    const [result] = await this.db
      .select({ productId: schema.products.id })
      .from(schema.products)
      .innerJoin(
        schema.organizations,
        eq(schema.products.organizationId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.products.id, productId),
          eq(schema.organizations.ownerId, userId),
        ),
      );

    return !!result;
  }
}
