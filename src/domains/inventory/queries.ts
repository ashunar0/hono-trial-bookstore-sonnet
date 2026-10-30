import { eq, inArray } from "drizzle-orm";
import type { Db } from "#/db/index";
import { reservationsTable, stocksTable } from "#/db/schema";

export const findStock = async (db: Db, bookId: string) => {
  const [row] = await db.select().from(stocksTable).where(eq(stocksTable.bookId, bookId)).limit(1);
  return row;
};

/** Stock and version by book id; a book with no row is not in the map (0 in stock, version 0) */
export const findStocks = async (db: Db, bookIds: string[]) => {
  if (bookIds.length === 0) return new Map<string, { stock: number; version: number }>();
  const rows = await db.select().from(stocksTable).where(inArray(stocksTable.bookId, bookIds));
  return new Map(rows.map((r) => [r.bookId, { stock: r.stock, version: r.version }]));
};

export const findReservation = async (db: Db, id: string) => {
  const [row] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.id, id))
    .limit(1);
  return row;
};
