import type { Db } from "#/db/index";
import { insertBook } from "../mutations";
import type { BookInput } from "../rules";

/** Registers a book. Its stock starts at 0 (a book with no stocks row has none) */
export const registerBook = async (deps: { db: Db }, input: BookInput, now: Date) => {
  const [book] = await insertBook(deps.db, crypto.randomUUID(), input, now);
  if (book === undefined) throw new Error("insert returned no row");
  return book;
};
