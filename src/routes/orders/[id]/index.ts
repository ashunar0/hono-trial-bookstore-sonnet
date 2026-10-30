import { createEndpoint, errorResponses, NotFound, requireAuth } from "hono-kit";
import { z } from "zod";
import { canSeeOrder } from "#/domains/order/rules";
import { readOrder } from "../_read";
import { orderResponseSchema } from "../_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    request: { param: z.object({ id: z.string() }) },
    responses: { 200: orderResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const order = await readOrder(c.var.deps.db, c.req.valid("param").id);
    // a placing order, and another customer's order, are not there for this user
    if (order === undefined || !canSeeOrder(order, c.var.currentUser)) {
      return reply.failure(NotFound.code);
    }
    return reply.success(order);
  },
);
