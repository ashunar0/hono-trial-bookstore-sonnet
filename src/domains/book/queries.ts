import { desc, eq, inArray } from "drizzle-orm";
import { toPage, type PageQuery } from "hono-kit/page";
import type { Db } from "#/db/index";
import { booksTable } from "#/db/schema";
import { olderThan } from "#/lib/page";

export const findBook = async (db: Db, id: string) => {
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id)).limit(1);
  return book;
};

export const findBooks = (db: Db, ids: string[]) =>
  ids.length === 0
    ? Promise.resolve([])
    : db.select().from(booksTable).where(inArray(booksTable.id, ids));

/** Newest first */
export const listBooks = async (db: Db, page: PageQuery) => {
  const rows = await db
    .select()
    .from(booksTable)
    .where(olderThan(booksTable.createdAt, booksTable.id, page.after))
    .orderBy(desc(booksTable.createdAt), desc(booksTable.id))
    .limit(page.limit + 1);
  return toPage(rows, page.limit, (b) => ({ at: b.createdAt, id: b.id }));
};
