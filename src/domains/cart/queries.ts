import { asc, eq } from "drizzle-orm";
import type { Db } from "#/db/index";
import { cartItemsTable } from "#/db/schema";

export const listCartItems = (db: Db, customerId: string) =>
  db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.customerId, customerId))
    .orderBy(asc(cartItemsTable.bookId));
