/**
 * The tables of this app (drizzle). `pnpm db:generate` writes migrations from here.
 * Each domain's tables sit under a heading of their own, so the owner shows
 */
import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
