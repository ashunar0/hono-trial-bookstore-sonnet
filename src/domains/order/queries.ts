import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { toPage, type PageQuery } from "hono-kit/page";
import type { Db } from "#/db/index";
import {
  orderLinesTable,
  ordersTable,
  refundsTable,
  returnLinesTable,
  returnsTable,
} from "#/db/schema";
import { olderThan } from "#/lib/page";
import type { OrderStatus, ReturnStatus } from "./rules";

export type OrderRow = typeof ordersTable.$inferSelect;
export type OrderLineRow = typeof orderLinesTable.$inferSelect;

export const findOrder = async (db: Db, id: string) => {
  const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  return row;
};

export const findOrderLines = (db: Db, orderIds: string[]) =>
  orderIds.length === 0
    ? Promise.resolve([])
    : db
        .select()
        .from(orderLinesTable)
        .where(inArray(orderLinesTable.orderId, orderIds))
        // in the order they were written: the order of the cart
        .orderBy(sql`rowid`);

/** Newest first. A placing order is never listed. customerId limits to one customer's */
export const listOrders = async (
  db: Db,
  filter: { customerId?: string; status?: OrderStatus },
  page: PageQuery,
) => {
  const rows = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        ne(ordersTable.status, "placing"),
        filter.customerId === undefined ? undefined : eq(ordersTable.customerId, filter.customerId),
        filter.status === undefined ? undefined : eq(ordersTable.status, filter.status),
        olderThan(ordersTable.createdAt, ordersTable.id, page.after),
      ),
    )
    .orderBy(desc(ordersTable.createdAt), desc(ordersTable.id))
    .limit(page.limit + 1);
  return toPage(rows, page.limit, (o) => ({ at: o.createdAt, id: o.id }));
};

export const findReturnsOfOrders = (db: Db, orderIds: string[]) =>
  orderIds.length === 0
    ? Promise.resolve([])
    : db
        .select()
        .from(returnsTable)
        .where(inArray(returnsTable.orderId, orderIds))
        .orderBy(returnsTable.requestedAt, returnsTable.id);

export const findReturnLines = (db: Db, returnIds: string[]) =>
  returnIds.length === 0
    ? Promise.resolve([])
    : db.select().from(returnLinesTable).where(inArray(returnLinesTable.returnId, returnIds));

export const findRefunds = (db: Db, orderIds: string[]) =>
  orderIds.length === 0
    ? Promise.resolve([])
    : db
        .select()
        .from(refundsTable)
        .where(inArray(refundsTable.orderId, orderIds))
        .orderBy(refundsTable.createdAt, refundsTable.id);

/** Orders that cron looks at: ids and versions, oldest first, at most `limit` */
export const findExpiredPayments = (db: Db, now: Date, limit: number) =>
  db
    .select({ id: ordersTable.id, version: ordersTable.version })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "awaiting_payment"), lt(ordersTable.paymentDueAt, now)))
    .orderBy(ordersTable.paymentDueAt)
    .limit(limit);

export const findStuckPlacing = (db: Db, before: Date, limit: number) =>
  db
    .select({ id: ordersTable.id, version: ordersTable.version })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "placing"), lt(ordersTable.createdAt, before)))
    .orderBy(ordersTable.createdAt)
    .limit(limit);

export const findUnrestoredCancels = async (db: Db, limit: number) =>
  db
    .select({ id: ordersTable.id, version: ordersTable.version })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "cancelled"), isNull(ordersTable.restoredAt)))
    .orderBy(ordersTable.cancelledAt)
    .limit(limit);

export const findReturn = async (db: Db, id: string) => {
  const [row] = await db.select().from(returnsTable).where(eq(returnsTable.id, id)).limit(1);
  return row;
};

/** Newest request first */
export const listReturns = async (db: Db, filter: { status?: ReturnStatus }, page: PageQuery) => {
  const rows = await db
    .select()
    .from(returnsTable)
    .where(
      and(
        filter.status === undefined ? undefined : eq(returnsTable.status, filter.status),
        olderThan(returnsTable.requestedAt, returnsTable.id, page.after),
      ),
    )
    .orderBy(desc(returnsTable.requestedAt), desc(returnsTable.id))
    .limit(page.limit + 1);
  return toPage(rows, page.limit, (r) => ({ at: r.requestedAt, id: r.id }));
};

/** How many books of each order line are in returns of these statuses, summed over the order's returns */
export const countReturnedBooks = async (db: Db, orderId: string, statuses: ReturnStatus[]) => {
  const rows = await db
    .select({ orderLineId: returnLinesTable.orderLineId, quantity: returnLinesTable.quantity })
    .from(returnLinesTable)
    .innerJoin(returnsTable, eq(returnsTable.id, returnLinesTable.returnId))
    .where(and(eq(returnsTable.orderId, orderId), inArray(returnsTable.status, statuses)));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.orderLineId, (counts.get(r.orderLineId) ?? 0) + r.quantity);
  return counts;
};

/** Completed returns whose books are not yet back on the shelf (cron finishes them) */
export const findUnrestockedReturns = (db: Db, limit: number) =>
  db
    .select({ id: returnsTable.id, version: returnsTable.version })
    .from(returnsTable)
    .where(and(eq(returnsTable.status, "completed"), isNull(returnsTable.restockedAt)))
    .orderBy(returnsTable.completedAt)
    .limit(limit);
