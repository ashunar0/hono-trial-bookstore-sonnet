import { eq, sql } from "drizzle-orm";
import type { Db } from "#/db/index";
import { cartItemsTable } from "#/db/schema";

export const listCartItems = (db: Db, customerId: string) =>
  db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.customerId, customerId))
    // in the order the books were put in the cart
    .orderBy(sql`rowid`);
