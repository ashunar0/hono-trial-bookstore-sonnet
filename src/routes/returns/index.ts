import { createEndpoint, pageQuerySchema, pageResponse, pageResponseSchema } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { listReturns } from "#/domains/order/index";
import { RETURN_STATUSES } from "#/domains/order/rules";
import { returnResponseSchema } from "../orders/_response";
import { readReturns } from "./_read";

export const GET = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { query: pageQuerySchema(z.object({ status: z.enum(RETURN_STATUSES).optional() })) },
    responses: { 200: pageResponseSchema(returnResponseSchema) },
  },
  async (c, reply) => {
    const { status, ...page } = c.req.valid("query");
    const found = await listReturns(c.var.deps.db, { status }, page);
    const items = await readReturns(c.var.deps.db, found.items);
    return reply.success(pageResponse({ items, next: found.next }, (r) => r));
  },
);
