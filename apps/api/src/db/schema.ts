import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  BASE_UNITS,
  COST_LINE_TYPES,
  EMPLOYEE_ROLES,
  OTP_CHANNELS,
  PAYMENT_METHODS,
  STORAGE_TYPES,
  WEEKDAYS,
} from '@organa/shared';

export const planEnum = pgEnum('plan', ['LITE', 'PREMIUM']);
export const employeeRoleEnum = pgEnum('employee_role', EMPLOYEE_ROLES);
export const otpChannelEnum = pgEnum('otp_channel', OTP_CHANNELS);
export const subjectKindEnum = pgEnum('subject_kind', ['owner', 'employee']);
export const weekdayEnum = pgEnum('weekday', WEEKDAYS);
export const baseUnitEnum = pgEnum('base_unit', BASE_UNITS);
export const storageEnum = pgEnum('storage_type', STORAGE_TYPES);
export const movementTypeEnum = pgEnum('movement_type', ['IN', 'SALE', 'WASTE', 'EXPIRED', 'ADJUST']);
export const costLineTypeEnum = pgEnum('cost_line_type', COST_LINE_TYPES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const countStatusEnum = pgEnum('count_status', ['OPEN', 'COMMITTED']);
export const alertKindEnum = pgEnum('alert_kind', ['CRITICAL', 'STOCKOUT', 'EXPIRING', 'EXPIRED']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const tenants = pgTable('tenants', {
  id: id(),
  /** Null until the owner finishes business setup. */
  name: text('name'),
  phone: text('phone'),
  address: text('address'),
  employeeCount: integer('employee_count'),
  plan: planEnum('plan').notNull().default('LITE'),
  createdAt: createdAt(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const outlets = pgTable(
  'outlets',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    createdAt: createdAt(),
  },
  (t) => [index('outlets_tenant_idx').on(t.tenantId)],
);

export const employees = pgTable(
  'employees',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: employeeRoleEnum('role').notNull(),
    pinHash: text('pin_hash').notNull(),
    shiftDays: weekdayEnum('shift_days').array().notNull().default(sql`'{}'`),
    active: boolean('active').notNull().default(true),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('employees_outlet_idx').on(t.tenantId, t.outletId)],
);

/** A shared phone or tablet an owner has bound to one outlet for employee PIN login. */
export const devices = pgTable(
  'devices',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    name: text('name'),
    tokenHash: text('token_hash').notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('devices_token_idx').on(t.tokenHash)],
);

export const otpChallenges = pgTable('otp_challenges', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  channel: otpChannelEnum('channel').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subjectKind: subjectKindEnum('subject_kind').notNull(),
    subjectId: uuid('subject_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_idx').on(t.tokenHash)],
);

const tenantId = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' });
const outletId = () =>
  uuid('outlet_id')
    .notNull()
    .references(() => outlets.id, { onDelete: 'cascade' });

export const stockCategories = pgTable(
  'stock_categories',
  {
    id: id(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('cube-outline'),
    parentId: uuid('parent_id'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('stock_categories_tenant_idx').on(t.tenantId)],
);

/** Ingredient master data is per tenant; stock and cost are per outlet (batches + movements). */
export const ingredients = pgTable(
  'ingredients',
  {
    id: id(),
    tenantId: tenantId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => stockCategories.id),
    name: text('name').notNull(),
    baseUnit: baseUnitEnum('base_unit').notNull(),
    criticalQty: doublePrecision('critical_qty').notNull().default(0),
    defaultStorage: storageEnum('default_storage').notNull().default('CHILLER'),
    expiryAlert: boolean('expiry_alert').notNull().default(true),
    criticalAlert: boolean('critical_alert').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('ingredients_tenant_idx').on(t.tenantId), uniqueIndex('ingredients_name_idx').on(t.tenantId, t.name)],
);

export const stockBatches = pgTable(
  'stock_batches',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    qtyInitial: doublePrecision('qty_initial').notNull(),
    qtyRemaining: doublePrecision('qty_remaining').notNull(),
    /** Rupiah per base unit. */
    unitCost: doublePrecision('unit_cost').notNull(),
    storage: storageEnum('storage').notNull(),
    expiryDate: date('expiry_date').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    createdByName: text('created_by_name').notNull(),
    /** Set when the expiry sweep writes the remainder off. */
    expiredAt: timestamp('expired_at', { withTimezone: true }),
  },
  (t) => [
    index('stock_batches_lookup_idx').on(t.outletId, t.ingredientId),
    index('stock_batches_expiry_idx').on(t.outletId, t.expiryDate),
  ],
);

/** Append-only ledger. On-hand stock = SUM(qty) per outlet + ingredient. */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id'),
    type: movementTypeEnum('type').notNull(),
    /** Signed, in base units. */
    qty: doublePrecision('qty').notNull(),
    unitCost: doublePrecision('unit_cost').notNull(),
    /** Signed rupiah value (qty × unit cost), rounded. */
    value: integer('value').notNull(),
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdByName: text('created_by_name').notNull(),
  },
  (t) => [
    index('stock_movements_lookup_idx').on(t.outletId, t.ingredientId, t.occurredAt),
    index('stock_movements_type_idx').on(t.outletId, t.type, t.occurredAt),
  ],
);

export const productCategories = pgTable(
  'product_categories',
  {
    id: id(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    icon: text('icon').notNull().default('restaurant-outline'),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('product_categories_tenant_idx').on(t.tenantId)],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    tenantId: tenantId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => productCategories.id),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    photoUrl: text('photo_url'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('products_tenant_idx').on(t.tenantId, t.categoryId)],
);

export const costLines = pgTable(
  'cost_lines',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: costLineTypeEnum('type').notNull(),
    ingredientId: uuid('ingredient_id').references(() => ingredients.id),
    label: text('label').notNull(),
    /** As entered (e.g. 200 gr); ingredient lines also store the base-unit quantity. */
    qty: doublePrecision('qty').notNull(),
    unit: text('unit').notNull(),
    qtyBase: doublePrecision('qty_base'),
    /** Manual lines only. */
    value: integer('value'),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('cost_lines_product_idx').on(t.productId)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    clientId: uuid('client_id').notNull(),
    number: text('number').notNull(),
    subtotal: integer('subtotal').notNull(),
    total: integer('total').notNull(),
    itemCount: integer('item_count').notNull(),
    cashierName: text('cashier_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('orders_client_idx').on(t.tenantId, t.clientId), index('orders_outlet_idx').on(t.outletId, t.createdAt)],
);

export const orderLines = pgTable(
  'order_lines',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    name: text('name').notNull(),
    qty: integer('qty').notNull(),
    unitPrice: integer('unit_price').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (t) => [index('order_lines_order_idx').on(t.orderId)],
);

export const payments = pgTable('payments', {
  id: id(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  method: paymentMethodEnum('method').notNull(),
  amount: integer('amount').notNull(),
  tendered: integer('tendered').notNull(),
  change: integer('change').notNull(),
  simulated: boolean('simulated').notNull().default(false),
});

export const stockCounts = pgTable(
  'stock_counts',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => stockCategories.id),
    status: countStatusEnum('status').notNull().default('OPEN'),
    countedByName: text('counted_by_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
  },
  (t) => [index('stock_counts_outlet_idx').on(t.outletId, t.createdAt)],
);

export const stockCountLines = pgTable(
  'stock_count_lines',
  {
    id: id(),
    countId: uuid('count_id')
      .notNull()
      .references(() => stockCounts.id, { onDelete: 'cascade' }),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    expected: doublePrecision('expected').notNull(),
    counted: doublePrecision('counted'),
    unitCost: doublePrecision('unit_cost').notNull(),
  },
  (t) => [uniqueIndex('stock_count_lines_idx').on(t.countId, t.ingredientId)],
);

/** Alerts raised by sales and the expiry sweep; the app polls these for notifications. */
export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    ingredientId: uuid('ingredient_id').references(() => ingredients.id, { onDelete: 'cascade' }),
    kind: alertKindEnum('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('alerts_outlet_idx').on(t.outletId, t.occurredAt)],
);

/** Cached AI/template text for the analysis and forecast screens. */
export const insights = pgTable(
  'insights',
  {
    id: id(),
    tenantId: tenantId(),
    outletId: outletId(),
    kind: text('kind').notNull(),
    period: text('period').notNull(),
    facts: jsonb('facts').notNull(),
    sections: jsonb('sections').notNull(),
    source: text('source').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('insights_key_idx').on(t.outletId, t.kind, t.period)],
);
