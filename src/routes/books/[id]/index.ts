import { allowAnonymous, createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { changeBook, findBook } from "#/domains/book/index";
import { bookInputSchema } from "#/domains/book/rules";
import { bookResponse, bookResponseSchema } from "../_response";

const param = z.object({ id: z.string() });

export const GET = createEndpoint(
  {
    auth: allowAnonymous,
    request: { param },
    responses: { 200: bookResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const book = await findBook(c.var.deps.db, c.req.valid("param").id);
    if (book === undefined) return reply.failure(NotFound.code);
    return reply.success(bookResponse(book));
  },
);

export const PUT = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { param, json: bookInputSchema },
    responses: { 200: bookResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const result = await changeBook(
      c.var.deps,
      c.req.valid("param").id,
      c.req.valid("json"),
      c.get("now"),
    );
    if (!result.ok) return reply.failure(result.error);
    return reply.success(bookResponse(result.value));
  },
);
