import { err, ok } from "hono-kit";
import { uniqueViolationOf } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import { insertCouponUse } from "../mutations";
import { findCouponUse } from "../queries";
import { CouponAlreadyUsed } from "../rules";

/**
 * Uses a coupon for a customer under the given id. The database allows one used row per coupon and customer.
 * Called again with the same id it has already been done
 */
export const useCoupon = async (
  deps: { db: Db },
  useId: string,
  couponId: string,
  customerId: string,
) => {
  if ((await findCouponUse(deps.db, useId)) !== undefined) return ok(undefined);
  try {
    await insertCouponUse(deps.db, useId, couponId, customerId);
  } catch (error) {
    const column = uniqueViolationOf(error);
    if (column === "coupon_uses.id") return ok(undefined);
    if (column?.startsWith("coupon_uses.coupon_id") === true) return err(CouponAlreadyUsed.code);
    throw error;
  }
  return ok(undefined);
};
