import type { Db } from "#/db/index";
import { releaseCouponUseRow } from "../mutations";

/** Gives a use back so the customer can use the coupon again. Twice, or for an id never used, changes nothing */
export const releaseCouponUse = async (deps: { db: Db }, useId: string) => {
  await releaseCouponUseRow(deps.db, useId);
};
