import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { and } from 'drizzle-orm/sql/expressions/conditions';
import { UpdateOrganizationDto } from './dtos/update-organization.dto';
import { MailService } from '../mail/mail.service';

type Org = typeof schema.organizations.$inferSelect;
type OrgWithSummary = Org & { productCount: number; categories: string[] };

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateOrganizationDto, ownerId: number) {
    const [newOrg] = await this.db
      .insert(schema.organizations)
      .values({
        name: dto.name,
        region: dto.region,
        address: dto.address,
        lat: dto.lat?.toString(),
        lng: dto.lng?.toString(),
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
    const orgs = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.ownerId, ownerId));
    return this.attachProductSummaries(orgs);
  }

  async getPending() {
    return this.db
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

    if (updatedOrg.ownerId) {
      const [owner] = await this.db
        .select({ email: schema.users.email, fullName: schema.users.fullName })
        .from(schema.users)
        .where(eq(schema.users.id, updatedOrg.ownerId));

      if (owner) {
        await this.mailService.sendOrganizationApproved(
          owner.email,
          owner.fullName,
          updatedOrg.name,
        );
      }
    }

    return updatedOrg;
  }

  async update(id: number, dto: UpdateOrganizationDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No data provided for update');
    }

    const { lat, lng, ...rest } = dto;
    const updateData = {
      ...rest,
      ...(lat !== undefined && { lat: lat.toString() }),
      ...(lng !== undefined && { lng: lng.toString() }),
    };

    const [updatedOrg] = await this.db
      .update(schema.organizations)
      .set(updateData)
      .where(eq(schema.organizations.id, id))
      .returning();

    if (!updatedOrg) throw new NotFoundException('Organization not found');
    return updatedOrg;
  }

  async getApproved() {
    const orgs = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.isApproved, 1));
    return this.attachProductSummaries(orgs);
  }

  private async attachProductSummaries(orgs: Org[]): Promise<OrgWithSummary[]> {
    if (orgs.length === 0) return [];
    const ids = orgs.map((o) => o.id);

    const rows = await this.db
      .select({
        organizationId: schema.products.organizationId,
        category: schema.products.category,
      })
      .from(schema.products)
      .where(inArray(schema.products.organizationId, ids));

    const counts = new Map<number, number>();
    const cats = new Map<number, Set<string>>();
    for (const r of rows) {
      counts.set(r.organizationId, (counts.get(r.organizationId) ?? 0) + 1);
      if (r.category) {
        if (!cats.has(r.organizationId)) cats.set(r.organizationId, new Set());
        cats.get(r.organizationId)!.add(r.category);
      }
    }

    return orgs.map((o) => ({
      ...o,
      productCount: counts.get(o.id) ?? 0,
      categories: Array.from(cats.get(o.id) ?? []).sort((a, b) =>
        a.localeCompare(b),
      ),
    }));
  }
}
