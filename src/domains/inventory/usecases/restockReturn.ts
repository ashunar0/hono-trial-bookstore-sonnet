import { uniqueViolationOf } from "hono-kit/sqlite";
import type { Db } from "#/db/index";
import { addStock, ensureStock, insertRestocks } from "../mutations";
import type { StockLine } from "../rules";

/** Puts the books of a return back on the shelf, once per return id. The second time is already done, so it succeeds */
export const restockReturn = async (deps: { db: Db }, returnId: string, lines: StockLine[]) => {
  const { db } = deps;
  try {
    await db.batch([
      insertRestocks(db, returnId, lines),
      ...lines.map((l) => ensureStock(db, l.bookId)),
      ...lines.map((l) => addStock(db, l)),
    ]);
  } catch (error) {
    if (uniqueViolationOf(error)?.startsWith("restocks.") === true) return;
    throw error;
  }
};
