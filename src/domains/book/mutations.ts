import { eq } from "drizzle-orm";
import type { Db } from "#/db/index";
import { booksTable } from "#/db/schema";
import type { BookInput } from "./rules";

export const insertBook = (db: Db, id: string, input: BookInput, now: Date) =>
  db
    .insert(booksTable)
    .values({ id, ...input, createdAt: now, updatedAt: now })
    .returning();

export const updateBook = (db: Db, id: string, input: BookInput, now: Date) =>
  db
    .update(booksTable)
    .set({ ...input, updatedAt: now })
    .where(eq(booksTable.id, id))
    .returning();
