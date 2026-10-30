import { and, eq, isNull } from "drizzle-orm";
import { updateWithVersion } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import { orderLinesTable, ordersTable } from "#/db/schema";

type NewOrder = typeof ordersTable.$inferInsert;
type NewLine = typeof orderLinesTable.$inferInsert;
type Values = Partial<Omit<NewOrder, "id" | "version">>;

export const insertOrder = (db: Db, order: NewOrder) => db.insert(ordersTable).values(order);

export const insertOrderLines = (db: Db, lines: NewLine[]) =>
  db.insert(orderLinesTable).values(lines);

/** Changes the order while its version is still the one read, counting it up. No row back: someone was first */
export const changeOrder = (db: Db, id: string, version: number, values: Values) =>
  updateWithVersion(db, ordersTable, { id, version }, values);

/** Records that the stock and coupon were given back, once */
export const markRestored = (db: Db, id: string, now: Date) =>
  db
    .update(ordersTable)
    .set({ restoredAt: now })
    .where(and(eq(ordersTable.id, id), isNull(ordersTable.restoredAt)));

/** Removes an order that never got past placing, with its lines */
export const deleteOrder = (db: Db, id: string) =>
  db.delete(ordersTable).where(eq(ordersTable.id, id));

export const deleteOrderLines = (db: Db, orderId: string) =>
  db.delete(orderLinesTable).where(eq(orderLinesTable.orderId, orderId));
