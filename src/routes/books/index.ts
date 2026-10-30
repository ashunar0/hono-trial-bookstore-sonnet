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
import { bookResponse, bookResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: allowAnonymous,
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(bookResponseSchema) },
  },
  async (c, reply) => {
    const page = await listBooks(c.var.deps.db, c.req.valid("query"));
    return reply.success(pageResponse(page, bookResponse));
  },
);

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { json: bookInputSchema },
    responses: { 200: bookResponseSchema, ...errorResponses() },
  },
  async (c, reply) => {
    const book = await registerBook(c.var.deps, c.req.valid("json"), c.get("now"));
    return reply.success(bookResponse(book));
  },
);
