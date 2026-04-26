import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
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
    if (dto.sku) {
      await this.assertSkuUnique(organizationId, dto.sku);
    }

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

  async findCategoriesByOrganization(organizationId: number): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ category: schema.products.category })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.organizationId, organizationId),
          isNotNull(schema.products.category),
        ),
      );
    return rows
      .map((r) => r.category)
      .filter((c): c is string => !!c)
      .sort((a, b) => a.localeCompare(b));
  }

  async findById(id: number) {
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No data provided for update');
    }

    if (dto.sku) {
      const [existing] = await this.db
        .select({ organizationId: schema.products.organizationId })
        .from(schema.products)
        .where(eq(schema.products.id, id));
      if (!existing) throw new NotFoundException('Product not found');
      await this.assertSkuUnique(existing.organizationId, dto.sku, id);
    }

    const [updated] = await this.db
      .update(schema.products)
      .set(dto)
      .where(eq(schema.products.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async setImageUrl(id: number, imageUrl: string | null) {
    const [updated] = await this.db
      .update(schema.products)
      .set({ imageUrl })
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

  private async assertSkuUnique(
    organizationId: number,
    sku: string,
    excludeId?: number,
  ) {
    const conditions = [
      eq(schema.products.organizationId, organizationId),
      sql`lower(${schema.products.sku}) = lower(${sku})`,
    ];
    if (excludeId !== undefined) {
      conditions.push(ne(schema.products.id, excludeId));
    }
    const [conflict] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(...conditions));
    if (conflict) {
      throw new ConflictException(
        `SKU "${sku}" is already used in this organization`,
      );
    }
  }
}
