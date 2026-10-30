import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { setStock } from "#/domains/inventory/index";
import { StockChanged, stockInputSchema } from "#/domains/inventory/rules";
import { readBook } from "../../_read";
import { bookResponseSchema } from "../../_response";

export const PUT = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { param: z.object({ id: z.string() }), json: stockInputSchema },
    responses: { 200: bookResponseSchema, ...errorResponses(NotFound, StockChanged) },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const result = await setStock(c.var.deps, id, c.req.valid("json"));
    if (!result.ok) return reply.failure(result.error);
    const shown = await readBook(c.var.deps.db, id);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
