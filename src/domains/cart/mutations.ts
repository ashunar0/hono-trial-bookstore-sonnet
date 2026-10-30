import { and, eq } from "drizzle-orm";
import type { Db } from "#/db/index";
import { cartItemsTable } from "#/db/schema";

/** Sets how many of the book the customer wants, whether or not it was in the cart */
export const upsertCartItem = (db: Db, customerId: string, bookId: string, quantity: number) =>
  db
    .insert(cartItemsTable)
    .values({ customerId, bookId, quantity })
    .onConflictDoUpdate({
      target: [cartItemsTable.customerId, cartItemsTable.bookId],
      set: { quantity },
    });

export const deleteCartItem = (db: Db, customerId: string, bookId: string) =>
  db
    .delete(cartItemsTable)
    .where(and(eq(cartItemsTable.customerId, customerId), eq(cartItemsTable.bookId, bookId)));

export const deleteCartItems = (db: Db, customerId: string) =>
  db.delete(cartItemsTable).where(eq(cartItemsTable.customerId, customerId));
