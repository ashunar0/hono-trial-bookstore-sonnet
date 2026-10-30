import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { z } from "zod";
import { requireRole } from "#/auth";
import { removeCartItem, setCartItem } from "#/domains/cart/index";
import { cartItemInputSchema } from "#/domains/cart/rules";
import { readCart } from "../../_read";
import { cartResponseSchema } from "../../_response";

const param = z.object({ bookId: z.string() });

export const PUT = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { param, json: cartItemInputSchema },
    responses: { 200: cartResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const { db } = c.var.deps;
    const customerId = c.var.currentUser.id;
    const result = await setCartItem(
      c.var.deps,
      customerId,
      c.req.valid("param").bookId,
      c.req.valid("json").quantity,
    );
    if (!result.ok) return reply.failure(result.error);
    const read = await readCart(db, customerId, c.get("now"));
    if (!read.ok) throw new Error("a cart without a coupon always has an estimate");
    return reply.success(read.cart);
  },
);

export const DELETE = createEndpoint(
  {
    auth: requireRole("customer"),
    request: { param },
    responses: { 200: z.object({ ok: z.literal(true) }) },
  },
  async (c, reply) => {
    await removeCartItem(c.var.deps, c.var.currentUser.id, c.req.valid("param").bookId);
    return reply.success({ ok: true });
  },
);
