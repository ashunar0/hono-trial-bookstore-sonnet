/**
 * The tables of this app (drizzle). `pnpm db:generate` writes migrations from here.
 * Each domain's tables sit under a heading of their own, so the owner shows
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── auth (Better Auth's tables; user has a role) ──────────────────────────

export const usersTable = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["customer", "staff"] })
    .notNull()
    .default("customer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const sessionsTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
});

export const accountsTable = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verificationsTable = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// ── book ──────────────────────────────────────────────────────────────────

export const booksTable = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    price: integer("price").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [check("books_price_positive", sql`${t.price} > 0`)],
);

// ── inventory ─────────────────────────────────────────────────────────────

/** A book with no row has 0 in stock. Every statement that changes stock also counts version up */
export const stocksTable = sqliteTable(
  "stocks",
  {
    bookId: text("book_id").primaryKey(),
    stock: integer("stock").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [check("stocks_stock_not_negative", sql`${t.stock} >= 0`)],
);

export const reservationsTable = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: ["reserved", "released"] }).notNull(),
  },
  (t) => [check("reservations_status", sql`${t.status} in ('reserved', 'released')`)],
);

export const reservationLinesTable = sqliteTable(
  "reservation_lines",
  {
    reservationId: text("reservation_id").notNull(),
    bookId: text("book_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reservationId, t.bookId] }),
    check("reservation_lines_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/** One row per (return, book): a second restock of the same return hits the primary key */
export const restocksTable = sqliteTable(
  "restocks",
  {
    returnId: text("return_id").notNull(),
    bookId: text("book_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.returnId, t.bookId] }),
    check("restocks_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// ── coupon ────────────────────────────────────────────────────────────────

export const couponsTable = sqliteTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type", { enum: ["fixed", "percent"] }).notNull(),
    /** Yen off for fixed, percent off for percent */
    value: integer("value").notNull(),
    /** The subtotal of the books must reach this (0 for none) */
    minAmount: integer("min_amount").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("coupons_code").on(t.code),
    check("coupons_type", sql`${t.type} in ('fixed', 'percent')`),
    check(
      "coupons_value",
      sql`(${t.type} = 'fixed' and ${t.value} > 0 and ${t.minAmount} >= ${t.value}) or (${t.type} = 'percent' and ${t.value} between 1 and 100 and ${t.minAmount} >= 0)`,
    ),
  ],
);

export const couponUsesTable = sqliteTable(
  "coupon_uses",
  {
    id: text("id").primaryKey(),
    couponId: text("coupon_id").notNull(),
    customerId: text("customer_id").notNull(),
    status: text("status", { enum: ["used", "released"] }).notNull(),
  },
  (t) => [
    // Only the uses still counted: a released one does not stop the next
    uniqueIndex("coupon_uses_once_per_customer")
      .on(t.couponId, t.customerId)
      .where(sql`${t.status} = 'used'`),
    check("coupon_uses_status", sql`${t.status} in ('used', 'released')`),
  ],
);

// ── cart ──────────────────────────────────────────────────────────────────

export const cartItemsTable = sqliteTable(
  "cart_items",
  {
    customerId: text("customer_id").notNull(),
    bookId: text("book_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.customerId, t.bookId] }),
    check("cart_items_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// ── order ─────────────────────────────────────────────────────────────────

export const ordersTable = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").notNull(),
    status: text("status", {
      enum: ["placing", "awaiting_payment", "paid", "shipped", "cancelled"],
    }).notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull(),
    shippingFee: integer("shipping_fee").notNull(),
    total: integer("total").notNull(),
    tax: integer("tax").notNull(),
    /** Other domains' ids are values only. couponCode is the code as it was when ordered, for showing */
    couponId: text("coupon_id"),
    couponCode: text("coupon_code"),
    /** Made before anything is held, and passed to inventory / coupon to hold, use and give back */
    couponUseId: text("coupon_use_id"),
    reservationId: text("reservation_id").notNull(),
    paymentDueAt: integer("payment_due_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    /** When the stock and the coupon were given back after a cancel */
    restoredAt: integer("restored_at", { mode: "timestamp_ms" }),
    version: integer("version").notNull(),
  },
  (t) => [
    check(
      "orders_status",
      sql`${t.status} in ('placing', 'awaiting_payment', 'paid', 'shipped', 'cancelled')`,
    ),
    index("orders_customer").on(t.customerId, t.createdAt),
    index("orders_status").on(t.status, t.createdAt),
  ],
);

export const orderLinesTable = sqliteTable(
  "order_lines",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    bookId: text("book_id").notNull(),
    /** Title and price as they were when ordered */
    title: text("title").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    /** The coupon's discount allotted to this line */
    discount: integer("discount").notNull(),
  },
  (t) => [
    check("order_lines_quantity_positive", sql`${t.quantity} > 0`),
    index("order_lines_order").on(t.orderId),
  ],
);

export const returnsTable = sqliteTable(
  "returns",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    status: text("status", { enum: ["requested", "completed", "rejected"] }).notNull(),
    rejectReason: text("reject_reason"),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    rejectedAt: integer("rejected_at", { mode: "timestamp_ms" }),
    /** When the books went back on the shelf */
    restockedAt: integer("restocked_at", { mode: "timestamp_ms" }),
    version: integer("version").notNull(),
  },
  (t) => [
    check("returns_status", sql`${t.status} in ('requested', 'completed', 'rejected')`),
    index("returns_order").on(t.orderId),
    index("returns_status").on(t.status, t.requestedAt),
  ],
);

export const returnLinesTable = sqliteTable(
  "return_lines",
  {
    returnId: text("return_id").notNull(),
    orderLineId: text("order_line_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.returnId, t.orderLineId] }),
    check("return_lines_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

export const refundsTable = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    /** Null for the refund of a cancel */
    returnId: text("return_id"),
    amount: integer("amount").notNull(),
    tax: integer("tax").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("refunds_return").on(t.returnId), index("refunds_order").on(t.orderId)],
);
