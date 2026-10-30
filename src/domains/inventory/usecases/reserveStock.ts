import { err, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { isCheckViolation } from "#/lib/db-errors";
import { ensureStock, insertReservation, insertReservationLines, takeStock } from "../mutations";
import { findReservation, findStocks } from "../queries";
import { OutOfStock, shortagesOf, type StockLine } from "../rules";

/**
 * Holds these books under the given id, all or none. Called again with the same id it does nothing more.
 * D1 does not tell which book was short, so after a failure the stock is read again for the details
 */
export const reserveStock = async (deps: { db: Db }, reservationId: string, lines: StockLine[]) => {
  const { db } = deps;
  if ((await findReservation(db, reservationId)) !== undefined) return ok(undefined);

  try {
    await db.batch([
      insertReservation(db, reservationId),
      insertReservationLines(db, reservationId, lines),
      ...lines.map((l) => ensureStock(db, l.bookId)),
      ...lines.map((l) => takeStock(db, l)),
    ]);
  } catch (error) {
    if (!isCheckViolation(error)) throw error;
    const stocks = await findStocks(
      db,
      lines.map((l) => l.bookId),
    );
    const books = shortagesOf(lines, new Map([...stocks].map(([id, s]) => [id, s.stock])));
    return err({ code: OutOfStock.code, details: { books } });
  }
  return ok(undefined);
};
