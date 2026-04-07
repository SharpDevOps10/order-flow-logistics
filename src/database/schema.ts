import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  timestamp,
  pgEnum,
  decimal,
} from 'drizzle-orm/pg-core';
import { Role } from '../common/enums/role.enum';

export const userRoleEnum = pgEnum('user_role', [
  Role.ADMIN,
  Role.CLIENT,
  Role.SUPPLIER,
  Role.COURIER,
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: userRoleEnum('role').default(Role.CLIENT).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  refreshToken: text('refresh_token'),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: integer('owner_id').references(() => users.id),
  region: text('region'),
  isApproved: integer('is_approved').default(0),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id')
    .references(() => users.id)
    .notNull(),
  organizationId: integer('organization_id')
    .references(() => organizations.id)
    .notNull(),
  courierId: integer('courier_id').references(() => users.id),

  status: text('status').default('PENDING').notNull(),

  deliveryAddress: text('delivery_address').notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),

  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  organizationId: integer('organization_id')
    .references(() => organizations.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  price: decimal('price', { precision: 10, scale: 2 }),
});
