import { err, ok } from "hono-kit";
import { uniqueViolationOf } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import { insertCoupon } from "../mutations";
import { CouponCodeTaken, type CouponInput } from "../rules";

export const createCoupon = async (deps: { db: Db }, input: CouponInput, now: Date) => {
  try {
    const [coupon] = await insertCoupon(deps.db, crypto.randomUUID(), input, now);
    if (coupon === undefined) throw new Error("insert returned no row");
    return ok(coupon);
  } catch (error) {
    if (uniqueViolationOf(error) === "coupons.code") return err(CouponCodeTaken.code);
    throw error;
  }
};
