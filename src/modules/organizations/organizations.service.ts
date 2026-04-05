import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { and } from 'drizzle-orm/sql/expressions/conditions';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateOrganizationDto, ownerId: number) {
    const [newOrg] = await this.db
      .insert(schema.organizations)
      .values({
        name: dto.name,
        region: dto.region,
        ownerId: ownerId,
        isApproved: 0,
      })
      .returning();

    return newOrg;
  }

  async isOwner(userId: number, organizationId: number): Promise<boolean> {
    const [org] = await this.db
      .select()
      .from(schema.organizations)
      .where(
        and(
          eq(schema.organizations.id, organizationId),
          eq(schema.organizations.ownerId, userId),
        ),
      );

    return !!org;
  }

  async getMyOrganizations(ownerId: number) {
    return await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.ownerId, ownerId));
  }

  async getPending() {
    return await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.isApproved, 0));
  }

  async approve(id: number) {
    const [updatedOrg] = await this.db
      .update(schema.organizations)
      .set({ isApproved: 1 })
      .where(eq(schema.organizations.id, id))
      .returning();

    if (!updatedOrg) throw new NotFoundException('Organization not found');
    return updatedOrg;
  }

  async update(id: number, dto: UpdateOrganizationDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No data provided for update');
    }

    const [updatedOrg] = await this.db
      .update(schema.organizations)
      .set(dto)
      .where(eq(schema.organizations.id, id))
      .returning();

    if (!updatedOrg) throw new NotFoundException('Organization not found');
    return updatedOrg;
  }

  async getApproved() {
    return await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.isApproved, 1));
  }
}
