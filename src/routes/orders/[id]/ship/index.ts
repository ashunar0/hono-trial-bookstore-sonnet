import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { shipOrder } from "#/domains/order/index";
import { OrderStatusConflict } from "#/domains/order/rules";
import { readOrder } from "../../_read";
import { orderResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { param: z.object({ id: z.string() }) },
    responses: { 200: orderResponseSchema, ...errorResponses(NotFound, OrderStatusConflict) },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const result = await shipOrder(c.var.deps, id, c.get("now"));
    if (!result.ok) return reply.failure(result.error);
    const shown = await readOrder(c.var.deps.db, id);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
