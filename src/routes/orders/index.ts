import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
  requireAuth,
} from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { CouponAlreadyUsed, CouponNotApplicable } from "#/domains/coupon/rules";
import { OutOfStock } from "#/domains/inventory/rules";
import { listOrders, placeOrder } from "#/domains/order/index";
import {
  CartEmpty,
  orderInputSchema,
  OrderStatusConflict,
  VISIBLE_STATUSES,
} from "#/domains/order/rules";
import { readOrder, readOrders } from "./_read";
import { orderResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    request: { query: pageQuerySchema(z.object({ status: z.enum(VISIBLE_STATUSES).optional() })) },
    responses: { 200: pageResponseSchema(orderResponseSchema) },
  },
  async (c, reply) => {
    const user = c.var.currentUser;
    const { status, ...page } = c.req.valid("query");
    const found = await listOrders(
      c.var.deps.db,
      { customerId: user.role === "staff" ? undefined : user.id, status },
      page,
    );
    const items = await readOrders(c.var.deps.db, found.items);
    return reply.success(pageResponse({ items, next: found.next }, (o) => o));
  },
);

export const POST = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { json: orderInputSchema },
    responses: {
      200: orderResponseSchema,
      ...errorResponses(
        CartEmpty,
        CouponNotApplicable,
        OutOfStock,
        CouponAlreadyUsed,
        OrderStatusConflict,
      ),
    },
  },
  async (c, reply) => {
    const result = await placeOrder(
      c.var.deps,
      c.var.currentUser.id,
      c.req.valid("json").couponCode,
      c.get("now"),
    );
    if (!result.ok) return reply.failure(result.error);
    const shown = await readOrder(c.var.deps.db, result.value);
    if (shown === undefined) throw new Error("the order just placed is missing");
    return reply.success(shown);
  },
);
