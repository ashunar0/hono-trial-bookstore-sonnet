import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { requestReturn } from "#/domains/order/index";
import {
  OrderStatusConflict,
  ReturnPeriodEnded,
  ReturnQuantityExceeded,
  returnInputSchema,
} from "#/domains/order/rules";
import { readReturnOf } from "../../_read";
import { returnResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { param: z.object({ id: z.string() }), json: returnInputSchema },
    responses: {
      200: returnResponseSchema,
      ...errorResponses(NotFound, OrderStatusConflict, ReturnPeriodEnded, ReturnQuantityExceeded),
    },
  },
  async (c, reply) => {
    const result = await requestReturn(
      c.var.deps,
      c.var.currentUser.id,
      c.req.valid("param").id,
      c.req.valid("json").lines,
      c.get("now"),
    );
    if (!result.ok) return reply.failure(result.error);
    const shown = await readReturnOf(c.var.deps.db, result.value);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
