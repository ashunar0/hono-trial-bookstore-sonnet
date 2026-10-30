import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { stopCoupon } from "#/domains/coupon/index";
import { couponResponse, couponResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { param: z.object({ id: z.string() }) },
    responses: { 200: couponResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const result = await stopCoupon(c.var.deps, c.req.valid("param").id, c.get("now"));
    if (!result.ok) return reply.failure(result.error);
    return reply.success(couponResponse(result.value));
  },
);
