import { expect, it } from "vitest";
import { bob, request, someone, staff } from "../../../../test/fixtures";
import { addToCart, newBook, newCoupon, NOW, placeOrder, stockOf } from "../../../../test/setup";

const DAY = 24 * 60 * 60 * 1000;

const orderOf = async (user: Parameters<typeof request>[0], id: string) =>
  (await (await request(user, "GET", `/orders/${id}`)).json()) as {
    status: string;
    version: number;
    refunds: { amount: number; tax: number; returnId: string | null }[];
  };

/** An order for 3 books of 1500 (4500), with stock 10 left at 7 */
const awaitingOrder = async (couponCode?: string) => {
  const me = someone();
  const book = await newBook(1500, 10);
  await addToCart(me, book, 3);
  const { order } = await placeOrder(me, couponCode);
  return { me, book, order };
};

it("pays an order awaiting payment, and only the owner customer can", async () => {
  const { me, order } = await awaitingOrder();
  expect((await request(staff, "POST", `/orders/${order.id}/pay`)).status).toBe(403);
  expect((await request(bob, "POST", `/orders/${order.id}/pay`)).status).toBe(404);
  expect((await request(null, "POST", `/orders/${order.id}/pay`)).status).toBe(401);

  const res = await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "paid",
    paidAt: NOW.toISOString(),
    version: 3,
  });

  const again = await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({
    error: { code: "ORDER_STATUS_CONFLICT", details: { status: "paid" } },
  });
  expect((await request(me, "POST", "/orders/nope/pay")).status).toBe(404);
});

it("turns a late payment away with 422, even though cron has not cancelled it yet", async () => {
  const { me, order } = await awaitingOrder();
  const due = new Date(NOW.getTime() + 3 * DAY);
  expect((await request(me, "POST", `/orders/${order.id}/pay`, undefined, due)).status).toBe(200);

  const other = await awaitingOrder();
  const late = await request(
    other.me,
    "POST",
    `/orders/${other.order.id}/pay`,
    undefined,
    new Date(due.getTime() + 1),
  );
  expect(late.status).toBe(422);
  expect(await late.json()).toMatchObject({ error: { code: "PAYMENT_DEADLINE_PASSED" } });
  expect((await orderOf(other.me, other.order.id)).status).toBe("awaiting_payment");
});

it("ships only a paid order, and only staff can", async () => {
  const { me, order } = await awaitingOrder();
  const early = await request(staff, "POST", `/orders/${order.id}/ship`);
  expect(early.status).toBe(409);
  expect(await early.json()).toMatchObject({ error: { details: { status: "awaiting_payment" } } });

  await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);
  expect((await request(me, "POST", `/orders/${order.id}/ship`)).status).toBe(403);
  const shipAt = new Date("2026-11-11T01:00:00Z");
  const res = await request(staff, "POST", `/orders/${order.id}/ship`, undefined, shipAt);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: "shipped", shippedAt: shipAt.toISOString() });
  expect((await request(staff, "POST", `/orders/${order.id}/ship`)).status).toBe(409);
  expect((await request(staff, "POST", "/orders/nope/ship")).status).toBe(404);
});

it("cancels an unpaid order: stock and coupon come back, no refund", async () => {
  const me = someone();
  const book = await newBook(3500, 5);
  const coupon = await newCoupon();
  await addToCart(me, book);
  const { order } = await placeOrder(me, coupon.code);
  expect(await stockOf(book)).toBe(4);

  const at = new Date("2026-11-10T05:00:00Z");
  const res = await request(
    me,
    "POST",
    `/orders/${order.id}/cancel`,
    { version: order.version },
    at,
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "cancelled",
    cancelledAt: at.toISOString(),
    refunds: [],
  });
  expect(await stockOf(book)).toBe(5);

  // the coupon is usable again
  await addToCart(me, book);
  expect((await placeOrder(me, coupon.code)).res.status).toBe(200);
});

it("cancels a paid order and refunds the whole total with its tax", async () => {
  const { me, book, order } = await awaitingOrder();
  const paid = await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);
  const { version } = (await paid.json()) as { version: number };

  const res = await request(me, "POST", `/orders/${order.id}/cancel`, { version });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "cancelled",
    refunds: [{ amount: 4500, tax: 409, returnId: null }],
  });
  expect(await stockOf(book)).toBe(10);
});

it("lets staff cancel before shipping, but nobody after", async () => {
  const { order } = await awaitingOrder();
  const res = await request(staff, "POST", `/orders/${order.id}/cancel`, {
    version: order.version,
  });
  expect(res.status).toBe(200);

  const other = await awaitingOrder();
  await request(other.me, "POST", `/orders/${other.order.id}/pay`, undefined, NOW);
  const shipped = (await (
    await request(staff, "POST", `/orders/${other.order.id}/ship`)
  ).json()) as { version: number };
  const refuse = await request(other.me, "POST", `/orders/${other.order.id}/cancel`, {
    version: shipped.version,
  });
  expect(refuse.status).toBe(409);
  expect(await refuse.json()).toMatchObject({ error: { details: { status: "shipped" } } });
  const refuseStaff = await request(staff, "POST", `/orders/${other.order.id}/cancel`, {
    version: shipped.version,
  });
  expect(refuseStaff.status).toBe(409);
});

it("hides another customer's order from cancel (404), and checks the body (400)", async () => {
  const { me, order } = await awaitingOrder();
  expect(
    (await request(bob, "POST", `/orders/${order.id}/cancel`, { version: order.version })).status,
  ).toBe(404);
  expect((await request(me, "POST", `/orders/${order.id}/cancel`, {})).status).toBe(400);
  expect((await request(null, "POST", `/orders/${order.id}/cancel`, { version: 1 })).status).toBe(
    401,
  );
});

it("answers 409 to a cancel made on a stale version (a payment got in first)", async () => {
  const { me, book, order } = await awaitingOrder();
  await request(me, "POST", `/orders/${order.id}/pay`, undefined, NOW);

  const stale = await request(me, "POST", `/orders/${order.id}/cancel`, { version: order.version });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({
    error: { code: "ORDER_STATUS_CONFLICT", details: { status: "paid" } },
  });
  // nothing was given back, nothing refunded
  expect(await stockOf(book)).toBe(7);
  expect((await orderOf(me, order.id)).refunds).toEqual([]);
  // cancelling twice: the second sees cancelled
  const fresh = await orderOf(me, order.id);
  expect(
    (await request(me, "POST", `/orders/${order.id}/cancel`, { version: fresh.version })).status,
  ).toBe(200);
  const twice = await request(me, "POST", `/orders/${order.id}/cancel`, {
    version: fresh.version + 1,
  });
  expect(twice.status).toBe(409);
});
