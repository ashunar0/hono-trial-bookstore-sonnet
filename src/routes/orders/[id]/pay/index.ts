import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { payOrder } from "#/domains/order/index";
import { OrderStatusConflict, PaymentDeadlinePassed } from "#/domains/order/rules";
import { readOrder } from "../../_read";
import { orderResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { param: z.object({ id: z.string() }) },
    responses: {
      200: orderResponseSchema,
      ...errorResponses(NotFound, PaymentDeadlinePassed, OrderStatusConflict),
    },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const result = await payOrder(c.var.deps, c.var.currentUser.id, id, c.get("now"));
    if (!result.ok) return reply.failure(result.error);
    const shown = await readOrder(c.var.deps.db, id);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
