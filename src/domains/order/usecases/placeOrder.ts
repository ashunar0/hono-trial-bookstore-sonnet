import { err, ok } from "hono-kit";
import { findBooks } from "#/domains/book/index";
import { clearCart, listCartItems } from "#/domains/cart/index";
import { findCouponByCode, useCoupon } from "#/domains/coupon/index";
import { CouponNotApplicable } from "#/domains/coupon/rules";
import { reserveStock } from "#/domains/inventory/index";
import { quote } from "#/domains/pricing/rules";
import type { Db } from "#/db/index";
import {
  changeOrder,
  deleteOrder,
  deleteOrderLines,
  insertOrder,
  insertOrderLines,
} from "../mutations";
import { findOrder } from "../queries";
import { allocateDiscount, CartEmpty, OrderStatusConflict, paymentDueAt } from "../rules";
import { giveBack } from "./_giveBack";

/**
 * Places an order from the customer's cart. The order is "placing" until everything is held, and
 * only then switched to "awaiting_payment" (an operation that takes switches last).
 * The ids for the hold and the coupon use are made first and saved with the order, so a run that
 * dies anywhere leaves what is needed to give them back.
 * Checks in the order of the docs: CART_EMPTY, COUPON_NOT_APPLICABLE, OUT_OF_STOCK, COUPON_ALREADY_USED
 */
export const placeOrder = async (
  deps: { db: Db },
  customerId: string,
  couponCode: string | undefined,
  now: Date,
) => {
  const { db } = deps;

  const cart = await listCartItems(db, customerId);
  const books = new Map(
    (
      await findBooks(
        db,
        cart.map((i) => i.bookId),
      )
    ).map((b) => [b.id, b]),
  );
  const items = cart.flatMap((i) => {
    const book = books.get(i.bookId);
    return book === undefined ? [] : [{ book, quantity: i.quantity }];
  });
  if (items.length === 0) return err(CartEmpty.code);

  const coupon = couponCode === undefined ? undefined : await findCouponByCode(db, couponCode);
  if (couponCode !== undefined && coupon === undefined) {
    return err({ code: CouponNotApplicable.code, details: { reason: "not_found" as const } });
  }

  const priced = quote(
    items.map((i) => ({ unitPrice: i.book.price, quantity: i.quantity })),
    coupon ?? null,
    now,
  );
  if (!priced.ok) {
    return err({ code: CouponNotApplicable.code, details: { reason: priced.reason } });
  }
  const { quote: q } = priced;

  // 1. the order, "placing", with its amounts and the ids of what will be held
  const order = {
    id: crypto.randomUUID(),
    customerId,
    status: "placing" as const,
    subtotal: q.subtotal,
    discount: q.discount,
    shippingFee: q.shippingFee,
    total: q.total,
    tax: q.tax,
    couponId: coupon?.id ?? null,
    couponCode: coupon?.code ?? null,
    couponUseId: coupon === undefined ? null : crypto.randomUUID(),
    reservationId: crypto.randomUUID(),
    paymentDueAt: paymentDueAt(now),
    createdAt: now,
    version: 1,
  };
  const discounts = allocateDiscount(
    items.map((i) => ({ unitPrice: i.book.price, quantity: i.quantity })),
    q.discount,
  );
  await db.batch([
    insertOrder(db, order),
    insertOrderLines(
      db,
      items.map((i, n) => ({
        id: crypto.randomUUID(),
        orderId: order.id,
        bookId: i.book.id,
        title: i.book.title,
        unitPrice: i.book.price,
        quantity: i.quantity,
        discount: discounts[n] ?? 0,
      })),
    ),
  ]);

  // gives up this order: nothing was promised, so what was held is given back and the order is
  // dropped, as if it was never made. (If this run dies before the delete, cron cancels it)
  const abandon = async () => {
    await giveBack(deps, order, now);
    await db.batch([deleteOrderLines(db, order.id), deleteOrder(db, order.id)]);
  };

  // 2. hold the stock
  const reserved = await reserveStock(
    deps,
    order.reservationId,
    items.map((i) => ({ bookId: i.book.id, quantity: i.quantity })),
  );
  if (!reserved.ok) {
    await abandon();
    return err(reserved.error);
  }

  // 3. use the coupon
  if (order.couponUseId !== null && coupon !== undefined) {
    const used = await useCoupon(deps, order.couponUseId, coupon.id, customerId);
    if (!used.ok) {
      await abandon();
      return err(used.error);
    }
  }

  // 4. switch to awaiting_payment, if nobody (cron) cancelled it meanwhile
  const [switched] = await changeOrder(db, order.id, 1, { status: "awaiting_payment" });
  if (switched === undefined) {
    await giveBack(deps, order, now);
    const current = await findOrder(db, order.id);
    return err({
      code: OrderStatusConflict.code,
      details: { status: current?.status ?? "cancelled" },
    });
  }

  // 5. empty the cart; if it fails the order stands
  await clearCart(deps, customerId);
  return ok(order.id);
};
