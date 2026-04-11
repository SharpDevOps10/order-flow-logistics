import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: NodePgDatabase<typeof schema>,
  ) {}

  async getCouriers() {
    return this.db
      .select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.role, Role.COURIER));
  }
}
