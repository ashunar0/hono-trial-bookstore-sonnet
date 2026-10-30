import { err, NotFound, ok } from "hono-kit";
import { uniqueViolationOf } from "hono-kit/sqlite";
import { findBook } from "#/domains/book/index";
import type { Db } from "#/db/index";
import { insertStock, setStockWithVersion } from "../mutations";
import { findStock } from "../queries";
import { StockChanged, type StockInput } from "../rules";

/** The shop fixes the stock of a book to a number. The version is the one the shop read; a book with no stocks row has version 0 */
export const setStock = async (deps: { db: Db }, bookId: string, input: StockInput) => {
  const { db } = deps;
  if ((await findBook(db, bookId)) === undefined) return err(NotFound.code);

  const current = await findStock(db, bookId);
  if (current === undefined) {
    if (input.version !== 0) return err(StockChanged.code);
    try {
      await insertStock(db, bookId, input.stock);
    } catch (error) {
      if (uniqueViolationOf(error) === "stocks.book_id") return err(StockChanged.code);
      throw error;
    }
    return ok({ bookId, stock: input.stock, version: 1 });
  }

  const [row] = await setStockWithVersion(db, bookId, input.version, input.stock);
  if (row === undefined) return err(StockChanged.code);
  return ok({ bookId, stock: row.stock, version: row.version });
};
