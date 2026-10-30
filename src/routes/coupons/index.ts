import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { requireRole } from "#/auth";
import { createCoupon, listCoupons } from "#/domains/coupon/index";
import { CouponCodeTaken, couponInputSchema } from "#/domains/coupon/rules";
import { couponResponse, couponResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(couponResponseSchema) },
  },
  async (c, reply) => {
    const page = await listCoupons(c.var.deps.db, c.req.valid("query"));
    return reply.success(pageResponse(page, couponResponse));
  },
);

export const POST = createEndpoint(
  {
    auth: requireRole("staff"),
    request: { json: couponInputSchema },
    responses: { 200: couponResponseSchema, ...errorResponses(CouponCodeTaken) },
  },
  async (c, reply) => {
    const result = await createCoupon(c.var.deps, c.req.valid("json"), c.get("now"));
    if (!result.ok) return reply.failure(result.error);
    return reply.success(couponResponse(result.value));
  },
);
