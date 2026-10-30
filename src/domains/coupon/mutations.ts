import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "#/db/index";
import { couponsTable, couponUsesTable } from "#/db/schema";
import type { CouponInput } from "./rules";

export const insertCoupon = (db: Db, id: string, input: CouponInput, now: Date) =>
  db
    .insert(couponsTable)
    .values({ id, ...input, createdAt: now })
    .returning();

/** Stops it, keeping the first time if it was stopped already */
export const stopCouponRow = (db: Db, id: string, now: Date) =>
  db
    .update(couponsTable)
    .set({ stoppedAt: now })
    .where(and(eq(couponsTable.id, id), isNull(couponsTable.stoppedAt)))
    .returning();

export const insertCouponUse = (db: Db, id: string, couponId: string, customerId: string) =>
  db.insert(couponUsesTable).values({ id, couponId, customerId, status: "used" });

/** Only a use that is still used becomes released */
export const releaseCouponUseRow = (db: Db, id: string) =>
  db
    .update(couponUsesTable)
    .set({ status: "released" })
    .where(and(eq(couponUsesTable.id, id), eq(couponUsesTable.status, "used")));
