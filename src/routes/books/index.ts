import {
  allowAnonymous,
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { requireRole } from "#/auth";
import { listBooks, registerBook } from "#/domains/book/index";
import { bookInputSchema } from "#/domains/book/rules";
import { readBook, withStock } from "./_read";
import { bookResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: allowAnonymous,
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(bookResponseSchema) },
  },
  async (c, reply) => {
    const { db } = c.var.deps;
    const page = await listBooks(db, c.req.valid("query"));
    const items = await withStock(db, page.items);
    return reply.success(pageResponse({ items, next: page.next }, (b) => b));
  },
);

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { json: bookInputSchema },
    responses: { 200: bookResponseSchema, ...errorResponses() },
  },
  async (c, reply) => {
    const { db } = c.var.deps;
    const book = await registerBook(c.var.deps, c.req.valid("json"), c.get("now"));
    const shown = await readBook(db, book.id);
    if (shown === undefined) throw new Error("the book just registered is missing");
    return reply.success(shown);
  },
);
