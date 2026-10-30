import { findBooks } from "#/domains/book/index";
import { findStocks } from "#/domains/inventory/index";
import type { Db } from "#/db/index";
import type { BookResponse } from "./_response";

type BookRow = { id: string; title: string; author: string; price: number };

/** Books as the API shows them: each with its stock, which the inventory domain keeps */
export const withStock = async (db: Db, books: BookRow[]): Promise<BookResponse[]> => {
  const stocks = await findStocks(
    db,
    books.map((b) => b.id),
  );
  return books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    price: b.price,
    stock: stocks.get(b.id)?.stock ?? 0,
    stockVersion: stocks.get(b.id)?.version ?? 0,
  }));
};

export const readBook = async (db: Db, id: string): Promise<BookResponse | undefined> => {
  const [book] = await findBooks(db, [id]);
  if (book === undefined) return undefined;
  const [shown] = await withStock(db, [book]);
  return shown;
};
