import { releaseCouponUse } from "#/domains/coupon/index";
import { releaseReservation } from "#/domains/inventory/index";
import type { Db } from "#/db/index";
import { insertRefund, markRestored } from "../mutations";

/**
 * Gives back what an order held: the money if it was paid, its stock, its coupon, then notes the time.
 * Each step does nothing the second time, so a cancel that died halfway is finished by calling this again
 */
export const giveBack = async (
  deps: { db: Db },
  order: {
    id: string;
    reservationId: string;
    couponUseId: string | null;
    paidAt: Date | null;
    total: number;
    tax: number;
  },
  now: Date,
) => {
  // a paid order gets its whole total back. The id is fixed by the order, so a second run adds nothing
  if (order.paidAt !== null) {
    await insertRefund(deps.db, {
      id: `refund-${order.id}`,
      orderId: order.id,
      returnId: null,
      amount: order.total,
      tax: order.tax,
      createdAt: now,
    });
  }
  await releaseReservation(deps, order.reservationId);
  if (order.couponUseId !== null) await releaseCouponUse(deps, order.couponUseId);
  await markRestored(deps.db, order.id, now);
};
