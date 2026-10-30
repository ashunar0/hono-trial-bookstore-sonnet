import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { updateBook } from "../mutations";
import { findBook } from "../queries";
import type { BookInput } from "../rules";

export const changeBook = async (deps: { db: Db }, id: string, input: BookInput, now: Date) => {
  if ((await findBook(deps.db, id)) === undefined) return err(NotFound.code);
  const [book] = await updateBook(deps.db, id, input, now);
  if (book === undefined) return err(NotFound.code);
  return ok(book);
};
