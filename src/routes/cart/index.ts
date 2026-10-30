import { createEndpoint, errorResponses } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { CouponNotApplicable } from "#/domains/coupon/rules";
import { readCart } from "./_read";
import { cartResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { query: z.object({ coupon: z.string().min(1).optional() }) },
    responses: { 200: cartResponseSchema, ...errorResponses(CouponNotApplicable) },
  },
  async (c, reply) => {
    const read = await readCart(
      c.var.deps.db,
      c.var.currentUser.id,
      c.get("now"),
      c.req.valid("query").coupon,
    );
    if (!read.ok) {
      return reply.failure({ code: CouponNotApplicable.code, details: { reason: read.reason } });
    }
    return reply.success(read.cart);
  },
);
