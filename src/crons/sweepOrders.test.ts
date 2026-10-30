import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { ordersTable, refundsTable } from "#/db/schema";
import { reserveStock } from "#/domains/inventory/index";
import { makeDeps } from "#/main";
import { db, request, someone } from "../../test/fixtures";
import { addToCart, newBook, newCoupon, NOW, placeOrder, stockOf } from "../../test/setup";
import { cron } from "./sweepOrders";

const DAY = 24 * 60 * 60 * 1000;
const run = (now: Date) => cron.run({ deps: makeDeps(env), now });

const statusOf = async (id: string) => {
  const [row] = await db().select().from(ordersTable).where(eq(ordersTable.id, id));
  return row;
};

it("cancels an order awaiting payment once its 3 days are over, giving stock and coupon back", async () => {
  const me = someone();
  const book = await newBook(3500, 5);
  const coupon = await newCoupon();
  await addToCart(me, book);
  const { order } = await placeOrder(me, coupon.code);
  expect(await stockOf(book)).toBe(4);

  await run(new Date(NOW.getTime() + 3 * DAY)); // exactly due: still payable
  expect((await statusOf(order.id))?.status).toBe("awaiting_payment");

  const after = new Date(NOW.getTime() + 3 * DAY + 15 * 60 * 1000);
  await run(after);
  expect((await statusOf(order.id))?.status).toBe("cancelled");
  expect((await statusOf(order.id))?.restoredAt).not.toBeNull();
  expect(await stockOf(book)).toBe(5);

  // running again changes nothing
  await run(after);
  expect(await stockOf(book)).toBe(5);

  await addToCart(me, book);
  expect((await placeOrder(me, coupon.code)).res.status).toBe(200);
});

it("leaves a paid order alone, however old", async () => {
  const me = someone();
  const book = await newBook(3000, 5);
  await addToCart(me, book);
  const { order } = await placeOrder(me);
  await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);
  await run(new Date(NOW.getTime() + 30 * DAY));
  expect((await statusOf(order.id))?.status).toBe("paid");
  expect(await stockOf(book)).toBe(4);
});

/** An order that died while placing: stock is held, the coupon maybe used, the state is still "placing" */
const stuckPlacing = async (withCoupon: boolean) => {
  const book = await newBook(1000, 5);
  const me = someone();
  const reservationId = crypto.randomUUID();
  const id = crypto.randomUUID();
  await reserveStock({ db: db() }, reservationId, [{ bookId: book, quantity: 2 }]);
  await db()
    .insert(ordersTable)
    .values({
      id,
      customerId: me.id,
      status: "placing",
      subtotal: 2000,
      discount: 0,
      shippingFee: 550,
      total: 2550,
      tax: 231,
      couponUseId: withCoupon ? crypto.randomUUID() : null,
      reservationId,
      paymentDueAt: new Date(NOW.getTime() + 3 * DAY),
      createdAt: NOW,
      version: 1,
    });
  return { book, id };
};

it("cancels an order stuck in placing for 10 minutes, not one that is younger", async () => {
  const { book, id } = await stuckPlacing(true);
  expect(await stockOf(book)).toBe(3);

  await run(new Date(NOW.getTime() + 9 * 60 * 1000));
  expect((await statusOf(id))?.status).toBe("placing");
  expect(await stockOf(book)).toBe(3);

  await run(new Date(NOW.getTime() + 11 * 60 * 1000));
  expect((await statusOf(id))?.status).toBe("cancelled");
  expect(await stockOf(book)).toBe(5);
});

it("finishes a cancel that stopped after the switch: gives back, refunds a paid order once", async () => {
  const { book, id } = await stuckPlacing(false);
  const paidAt = new Date(NOW.getTime() + 1000);
  // the state after "cancelled" was written and the process died: paid before, not yet restored
  await db()
    .update(ordersTable)
    .set({ status: "cancelled", paidAt, cancelledAt: paidAt, version: 3 })
    .where(eq(ordersTable.id, id));
  expect(await stockOf(book)).toBe(3);

  const now = new Date(NOW.getTime() + 60 * 1000);
  await run(now);
  expect(await stockOf(book)).toBe(5);
  expect((await statusOf(id))?.restoredAt).toEqual(now);
  const refunds = await db().select().from(refundsTable).where(eq(refundsTable.orderId, id));
  expect(refunds).toHaveLength(1);
  expect(refunds[0]).toMatchObject({ amount: 2550, tax: 231, returnId: null });

  await run(new Date(now.getTime() + 15 * 60 * 1000));
  expect(await stockOf(book)).toBe(5);
  expect(await db().select().from(refundsTable).where(eq(refundsTable.orderId, id))).toHaveLength(
    1,
  );
});

it("cancels several overdue orders in one run", async () => {
  const me = someone();
  const book = await newBook(3000, 500);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    await addToCart(me, book);
    ids.push((await placeOrder(me)).order.id);
  }
  const later = new Date(NOW.getTime() + 4 * DAY);
  await run(later);
  for (const id of ids) expect((await statusOf(id))?.status).toBe("cancelled");
});
