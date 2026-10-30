import { and, eq, isNull } from "drizzle-orm";
import { updateWithVersion } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import {
  orderLinesTable,
  ordersTable,
  refundsTable,
  returnLinesTable,
  returnsTable,
} from "#/db/schema";

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

/** Records a refund. A refund with this id already there (the step ran before) is left as it is */
export const insertRefund = (db: Db, refund: typeof refundsTable.$inferInsert) =>
  db.insert(refundsTable).values(refund).onConflictDoNothing();

export const insertReturn = (db: Db, row: typeof returnsTable.$inferInsert) =>
  db.insert(returnsTable).values(row);

export const insertReturnLines = (db: Db, rows: (typeof returnLinesTable.$inferInsert)[]) =>
  db.insert(returnLinesTable).values(rows);

/** Takes back a request that turned out to be over what could be returned */
export const deleteReturn = (db: Db, id: string) =>
  db.delete(returnsTable).where(eq(returnsTable.id, id));

export const deleteReturnLines = (db: Db, returnId: string) =>
  db.delete(returnLinesTable).where(eq(returnLinesTable.returnId, returnId));

/** Changes the return while its version is still the one read, counting it up */
export const changeReturn = (
  db: Db,
  id: string,
  version: number,
  values: Partial<Omit<typeof returnsTable.$inferInsert, "id" | "version">>,
) => updateWithVersion(db, returnsTable, { id, version }, values);

/** Notes that the books are back on the shelf, once */
export const markRestocked = (db: Db, id: string, now: Date) =>
  db
    .update(returnsTable)
    .set({ restockedAt: now })
    .where(and(eq(returnsTable.id, id), isNull(returnsTable.restockedAt)));
