import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { stopCouponRow } from "../mutations";
import { findCoupon } from "../queries";

/** Stops a coupon: it can no longer be used, and orders that already used it stay as they are. Stopping twice is fine */
export const stopCoupon = async (deps: { db: Db }, id: string, now: Date) => {
  if ((await findCoupon(deps.db, id)) === undefined) return err(NotFound.code);
  await stopCouponRow(deps.db, id, now);
  const coupon = await findCoupon(deps.db, id);
  if (coupon === undefined) return err(NotFound.code);
  return ok(coupon);
};
