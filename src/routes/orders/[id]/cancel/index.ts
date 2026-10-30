import { createEndpoint, errorResponses, NotFound, requireAuth } from "hono-kit";
import { z } from "zod";
import { cancelOrder } from "#/domains/order/index";
import { OrderStatusConflict } from "#/domains/order/rules";
import { readOrder } from "../../_read";
import { orderResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireAuth,
    request: {
      param: z.object({ id: z.string() }),
      json: z.object({ version: z.number().int().min(1) }),
    },
    responses: { 200: orderResponseSchema, ...errorResponses(NotFound, OrderStatusConflict) },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const user = c.var.currentUser;
    const result = await cancelOrder(
      c.var.deps,
      user.role === "staff" ? { kind: "staff" } : { kind: "customer", id: user.id },
      id,
      c.req.valid("json").version,
      c.get("now"),
    );
    if (!result.ok) return reply.failure(result.error);
    const shown = await readOrder(c.var.deps.db, id);
    if (shown === undefined) return reply.failure(NotFound.code);
    return reply.success(shown);
  },
);
