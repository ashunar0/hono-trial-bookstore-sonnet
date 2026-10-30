import { err, NotFound, ok } from "hono-kit";
import { findBook } from "#/domains/book/index";
import type { Db } from "#/db/index";
import { upsertCartItem } from "../mutations";

/** Puts the book in the cart, or changes how many. Only a book that exists */
export const setCartItem = async (
  deps: { db: Db },
  customerId: string,
  bookId: string,
  quantity: number,
) => {
  if ((await findBook(deps.db, bookId)) === undefined) return err(NotFound.code);
  await upsertCartItem(deps.db, customerId, bookId, quantity);
  return ok(undefined);
};
