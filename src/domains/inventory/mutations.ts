import { eq, sql } from "drizzle-orm";
import { updateWithVersion } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import { reservationLinesTable, reservationsTable, restocksTable, stocksTable } from "#/db/schema";
import type { StockLine } from "./rules";

/** The first stocks row of a book, with the stock set. Fails on the primary key when the book already has one */
export const insertStock = (db: Db, bookId: string, stock: number) =>
  db.insert(stocksTable).values({ bookId, stock, version: 1 });

/** Sets the stock while the version is still the one read */
export const setStockWithVersion = (db: Db, bookId: string, version: number, stock: number) =>
  updateWithVersion(db, stocksTable, { bookId, version }, { stock });

/** Makes sure the book has a row (0 in stock), so the statements that follow have one to change */
export const ensureStock = (db: Db, bookId: string) =>
  db.insert(stocksTable).values({ bookId, stock: 0, version: 1 }).onConflictDoNothing();

/** stock = stock - quantity. CHECK (stock >= 0) fails the whole batch when it is not enough */
export const takeStock = (db: Db, line: StockLine) =>
  db
    .update(stocksTable)
    .set({
      stock: sql`${stocksTable.stock} - ${line.quantity}`,
      version: sql`${stocksTable.version} + 1`,
    })
    .where(eq(stocksTable.bookId, line.bookId));

export const addStock = (db: Db, line: StockLine) =>
  db
    .update(stocksTable)
    .set({
      stock: sql`${stocksTable.stock} + ${line.quantity}`,
      version: sql`${stocksTable.version} + 1`,
    })
    .where(eq(stocksTable.bookId, line.bookId));

export const insertReservation = (db: Db, id: string) =>
  db.insert(reservationsTable).values({ id, status: "reserved" });

export const insertReservationLines = (db: Db, id: string, lines: StockLine[]) =>
  db
    .insert(reservationLinesTable)
    .values(lines.map((l) => ({ reservationId: id, bookId: l.bookId, quantity: l.quantity })));

/** Gives the held books back, only while the hold is still reserved */
export const giveBackHeldStock = (db: Db, reservationId: string) =>
  db
    .update(stocksTable)
    .set({
      stock: sql`${stocksTable.stock} + (select ${reservationLinesTable.quantity} from ${reservationLinesTable} where ${reservationLinesTable.reservationId} = ${reservationId} and ${reservationLinesTable.bookId} = ${stocksTable.bookId})`,
      version: sql`${stocksTable.version} + 1`,
    })
    .where(
      sql`${stocksTable.bookId} in (select ${reservationLinesTable.bookId} from ${reservationLinesTable} where ${reservationLinesTable.reservationId} = ${reservationId}) and exists (select 1 from ${reservationsTable} where ${reservationsTable.id} = ${reservationId} and ${reservationsTable.status} = 'reserved')`,
    );

/** Marks the hold released, only while it is reserved. Comes after giveBackHeldStock */
export const markReleased = (db: Db, reservationId: string) =>
  db
    .update(reservationsTable)
    .set({ status: "released" })
    .where(
      sql`${reservationsTable.id} = ${reservationId} and ${reservationsTable.status} = 'reserved'`,
    );

export const insertRestocks = (db: Db, returnId: string, lines: StockLine[]) =>
  db
    .insert(restocksTable)
    .values(lines.map((l) => ({ returnId, bookId: l.bookId, quantity: l.quantity })));
