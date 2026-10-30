import type { Db } from "#/db/index";
import { deleteCartItem } from "../mutations";

/** Takes the book out. A book not in the cart is fine: it is out either way */
export const removeCartItem = async (deps: { db: Db }, customerId: string, bookId: string) => {
  await deleteCartItem(deps.db, customerId, bookId);
};
