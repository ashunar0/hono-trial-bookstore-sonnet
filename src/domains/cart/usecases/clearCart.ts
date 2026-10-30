import type { Db } from "#/db/index";
import { deleteCartItems } from "../mutations";

/** Empties the cart. Twice is the same as once */
export const clearCart = async (deps: { db: Db }, customerId: string) => {
  await deleteCartItems(deps.db, customerId);
};
