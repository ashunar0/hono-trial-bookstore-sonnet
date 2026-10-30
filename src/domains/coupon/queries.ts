import { desc, eq, inArray } from "drizzle-orm";
import { toPage, type PageQuery } from "hono-kit/page";
import type { Db } from "#/db/index";
import { couponsTable, couponUsesTable } from "#/db/schema";
import { olderThan } from "#/lib/page";

export const findCoupon = async (db: Db, id: string) => {
  const [row] = await db.select().from(couponsTable).where(eq(couponsTable.id, id)).limit(1);
  return row;
};

export const findCouponByCode = async (db: Db, code: string) => {
  const [row] = await db.select().from(couponsTable).where(eq(couponsTable.code, code)).limit(1);
  return row;
};

export const findCoupons = (db: Db, ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([])
    : db.select().from(couponsTable).where(inArray(couponsTable.id, ids));

export const findCouponUse = async (db: Db, id: string) => {
  const [row] = await db.select().from(couponUsesTable).where(eq(couponUsesTable.id, id)).limit(1);
  return row;
};

/** Newest first */
export const listCoupons = async (db: Db, page: PageQuery) => {
  const rows = await db
    .select()
    .from(couponsTable)
    .where(olderThan(couponsTable.createdAt, couponsTable.id, page.after))
    .orderBy(desc(couponsTable.createdAt), desc(couponsTable.id))
    .limit(page.limit + 1);
  return toPage(rows, page.limit, (c) => ({ at: c.createdAt, id: c.id }));
};
