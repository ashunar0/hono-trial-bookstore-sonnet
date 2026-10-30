import { releaseCouponUse } from "#/domains/coupon/index";
import { releaseReservation } from "#/domains/inventory/index";
import type { Db } from "#/db/index";
import { markRestored } from "../mutations";

/**
 * Gives back what an order held: its stock, then its coupon, then notes the time.
 * Each step does nothing the second time, so a cancel that died halfway is finished by calling this again
 */
export const giveBack = async (
  deps: { db: Db },
  order: { id: string; reservationId: string; couponUseId: string | null },
  now: Date,
) => {
  await releaseReservation(deps, order.reservationId);
  if (order.couponUseId !== null) await releaseCouponUse(deps, order.couponUseId);
  await markRestored(deps.db, order.id, now);
};
