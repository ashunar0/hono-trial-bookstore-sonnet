import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { returnsTable } from "#/db/schema";
import { bob, db, request, someone, staff } from "../../../test/fixtures";
import {
  addToCart,
  newBook,
  newCoupon,
  payAndShip,
  placeOrder,
  requestReturn,
  SHIPPED_AT,
  stockOf,
} from "../../../test/setup";

const DAY = 24 * 60 * 60 * 1000;
const RETURN_AT = new Date("2026-11-12T00:00:00Z");

/** The example of the design: A 2000 + B 1500 with 500 off, shipped */
const exampleOrder = async () => {
  const me = someone();
  const a = await newBook(2000, 5);
  const b = await newBook(1500, 5);
  const coupon = await newCoupon();
  await addToCart(me, a);
  await addToCart(me, b);
  const { order } = await placeOrder(me, coupon.code);
  const shipped = await payAndShip(me, order.id);
  const lineOf = (bookId: string) => shipped.lines.find((l) => l.bookId === bookId)?.id ?? "";
  return { me, a, b, coupon, order: shipped, lineB: lineOf(b), lineA: lineOf(a) };
};

/** An order of one line: 3 books of 1000, 500 off (2500 paid) */
const threeBooks = async () => {
  const me = someone();
  const book = await newBook(1000, 5);
  const coupon = await newCoupon({ minAmount: 3000 });
  await addToCart(me, book, 3);
  const { order } = await placeOrder(me, coupon.code);
  const shipped = await payAndShip(me, order.id);
  return { me, book, order: shipped, line: shipped.lines[0]?.id ?? "" };
};

it("returns book B of the example: refund 1285 with tax 116, stock back, coupon not back", async () => {
  const { me, b, coupon, order, lineB } = await exampleOrder();
  expect(await stockOf(b)).toBe(4);

  const { res, ret } = await requestReturn(me, order.id, [{ orderLineId: lineB, quantity: 1 }]);
  expect(res.status).toBe(200);
  expect(ret).toMatchObject({ status: "requested", lines: [{ orderLineId: lineB, quantity: 1 }] });
  expect(await stockOf(b)).toBe(4); // nothing yet: the shop has not received it

  const received = await request(staff, "POST", `/returns/${ret.id}/receive`, undefined, RETURN_AT);
  expect(received.status).toBe(200);
  expect(await received.json()).toMatchObject({
    status: "completed",
    completedAt: RETURN_AT.toISOString(),
  });
  expect(await stockOf(b)).toBe(5);

  const shown = (await (await request(me, "GET", `/orders/${order.id}`)).json()) as {
    status: string;
    refunds: unknown[];
    returns: unknown[];
  };
  expect(shown.status).toBe("shipped"); // a return is not a state of the order
  expect(shown.returns).toHaveLength(1);
  expect(shown.refunds).toEqual([
    expect.objectContaining({ returnId: ret.id, amount: 1285, tax: 116 }),
  ]);

  // the coupon stays used
  await addToCart(me, await newBook(3500, 5));
  const again = await placeOrder(me, coupon.code);
  expect(again.res.status).toBe(409);
});

it("accepts a return until 14 days after shipping, and then answers RETURN_PERIOD_ENDED (422)", async () => {
  const { me, order, lineB } = await exampleOrder();
  const lines = [{ orderLineId: lineB, quantity: 1 }];
  const last = new Date(SHIPPED_AT.getTime() + 14 * DAY);

  const late = await requestReturn(me, order.id, lines, new Date(last.getTime() + 1));
  expect(late.res.status).toBe(422);
  expect(await late.res.json()).toMatchObject({ error: { code: "RETURN_PERIOD_ENDED" } });
  expect((await requestReturn(me, order.id, lines, last)).res.status).toBe(200);
});

it("refuses an order that is not shipped (409), another's order (404), staff (403), and bad input", async () => {
  const me = someone();
  await addToCart(me, await newBook(3000, 5));
  const { order } = await placeOrder(me);
  const line = order.lines[0]?.id ?? "";
  const early = await requestReturn(me, order.id, [{ orderLineId: line, quantity: 1 }]);
  expect(early.res.status).toBe(409);
  expect(await early.res.json()).toMatchObject({
    error: { code: "ORDER_STATUS_CONFLICT", details: { status: "awaiting_payment" } },
  });

  const shipped = await payAndShip(me, order.id);
  const one = [{ orderLineId: line, quantity: 1 }];
  expect((await requestReturn(bob, shipped.id, one)).res.status).toBe(404);
  expect((await requestReturn(staff, shipped.id, one)).res.status).toBe(403);
  expect(
    (await requestReturn(me, shipped.id, [{ orderLineId: "nope", quantity: 1 }])).res.status,
  ).toBe(404);
  expect((await requestReturn(me, "nope", one)).res.status).toBe(404);
  expect((await requestReturn(me, shipped.id, [])).res.status).toBe(400);
  expect(
    (await requestReturn(me, shipped.id, [{ orderLineId: line, quantity: 0 }])).res.status,
  ).toBe(400);
  expect((await requestReturn(me, shipped.id, [...one, ...one])).res.status).toBe(400);
  expect((await requestReturn(null as never, shipped.id, one)).res.status).toBe(401);
});

it("counts requested and completed books, not rejected ones, against the shipped count", async () => {
  const { me, order, line } = await threeBooks();
  const first = await requestReturn(me, order.id, [{ orderLineId: line, quantity: 2 }]);
  expect(first.res.status).toBe(200);

  const over = await requestReturn(me, order.id, [{ orderLineId: line, quantity: 2 }]);
  expect(over.res.status).toBe(409);
  expect(await over.res.json()).toMatchObject({
    error: {
      code: "RETURN_QUANTITY_EXCEEDED",
      details: { lines: [{ orderLineId: line, returnable: 1 }] },
    },
  });

  // once the shop turns the first one down, those books can be asked for again
  const rejected = await request(staff, "POST", `/returns/${first.ret.id}/reject`, {
    reason: "dirty",
  });
  expect(rejected.status).toBe(200);
  expect((await requestReturn(me, order.id, [{ orderLineId: line, quantity: 3 }])).res.status).toBe(
    200,
  );
});

it("gives back 834, 834, 832 for three books bought with 500 off, 2500 in all", async () => {
  const { me, book, order, line } = await threeBooks();
  const amounts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const { ret } = await requestReturn(me, order.id, [{ orderLineId: line, quantity: 1 }]);
    await request(staff, "POST", `/returns/${ret.id}/receive`, undefined, RETURN_AT);
    const shown = (await (await request(me, "GET", `/orders/${order.id}`)).json()) as {
      refunds: { returnId: string; amount: number }[];
    };
    amounts.push(shown.refunds.find((r) => r.returnId === ret.id)?.amount ?? -1);
  }
  expect(amounts).toEqual([834, 834, 832]);
  expect(await stockOf(book)).toBe(5);
  const fourth = await requestReturn(me, order.id, [{ orderLineId: line, quantity: 1 }]);
  expect(fourth.res.status).toBe(409);
});

it("refunds the price less the discount whatever the order total fell to (no second look at the coupon)", async () => {
  const { me, order, lineA, lineB } = await exampleOrder();
  // returning A leaves B (1500 - 215 = 1285 paid for it), under the coupon's 3000 line: no discount is taken back
  const { ret } = await requestReturn(me, order.id, [{ orderLineId: lineA, quantity: 1 }]);
  await request(staff, "POST", `/returns/${ret.id}/receive`, undefined, RETURN_AT);
  const shown = (await (await request(me, "GET", `/orders/${order.id}`)).json()) as {
    refunds: { amount: number; tax: number }[];
    lines: { id: string }[];
  };
  expect(shown.refunds).toEqual([expect.objectContaining({ amount: 1715, tax: 155 })]); // 2000 - 285
  expect(lineB).toBeDefined();
});

it("receives or rejects a return once: the second try is RETURN_STATUS_CONFLICT with the state", async () => {
  const { me, order, lineB } = await exampleOrder();
  const { ret } = await requestReturn(me, order.id, [{ orderLineId: lineB, quantity: 1 }]);

  expect((await request(me, "POST", `/returns/${ret.id}/receive`)).status).toBe(403);
  expect((await request(null, "POST", `/returns/${ret.id}/receive`)).status).toBe(401);
  expect((await request(staff, "POST", "/returns/nope/receive")).status).toBe(404);
  expect((await request(staff, "POST", "/returns/nope/reject", { reason: "x" })).status).toBe(404);
  expect((await request(staff, "POST", `/returns/${ret.id}/reject`, {})).status).toBe(400);
  expect((await request(staff, "POST", `/returns/${ret.id}/reject`, { reason: "" })).status).toBe(
    400,
  );

  expect((await request(staff, "POST", `/returns/${ret.id}/receive`)).status).toBe(200);
  const twice = await request(staff, "POST", `/returns/${ret.id}/receive`);
  expect(twice.status).toBe(409);
  expect(await twice.json()).toMatchObject({
    error: { code: "RETURN_STATUS_CONFLICT", details: { status: "completed" } },
  });
  const reject = await request(staff, "POST", `/returns/${ret.id}/reject`, { reason: "late" });
  expect(reject.status).toBe(409);
});

it("rejecting leaves the reason, refunds nothing and moves no stock", async () => {
  const { me, b, order, lineB } = await exampleOrder();
  const { ret } = await requestReturn(me, order.id, [{ orderLineId: lineB, quantity: 1 }]);
  const res = await request(staff, "POST", `/returns/${ret.id}/reject`, {
    reason: "never arrived",
  });
  expect(await res.json()).toMatchObject({ status: "rejected", rejectReason: "never arrived" });
  expect(await stockOf(b)).toBe(4);
  const shown = (await (await request(me, "GET", `/orders/${order.id}`)).json()) as {
    refunds: unknown[];
  };
  expect(shown.refunds).toEqual([]);
  expect((await request(staff, "POST", `/returns/${ret.id}/receive`)).status).toBe(409);
});

it("lists returns for staff only, newest request first, filtered by status", async () => {
  const { me, order, lineA, lineB } = await exampleOrder();
  const first = await requestReturn(
    me,
    order.id,
    [{ orderLineId: lineA, quantity: 1 }],
    new Date("2026-11-12T01:00:00Z"),
  );
  const second = await requestReturn(
    me,
    order.id,
    [{ orderLineId: lineB, quantity: 1 }],
    new Date("2026-11-12T02:00:00Z"),
  );
  await request(staff, "POST", `/returns/${first.ret.id}/receive`);

  expect((await request(me, "GET", "/returns")).status).toBe(403);
  expect((await request(null, "GET", "/returns")).status).toBe(401);
  const all = (await (await request(staff, "GET", "/returns?limit=100")).json()) as {
    items: { id: string }[];
  };
  const ids = all.items.map((r) => r.id);
  expect(ids.indexOf(second.ret.id)).toBeLessThan(ids.indexOf(first.ret.id));
  const waiting = (await (
    await request(staff, "GET", "/returns?status=requested&limit=100")
  ).json()) as {
    items: { id: string; status: string }[];
  };
  expect(waiting.items.map((r) => r.id)).toContain(second.ret.id);
  expect(waiting.items.every((r) => r.status === "requested")).toBe(true);
  expect(waiting.items.map((r) => r.id)).not.toContain(first.ret.id);
  expect((await request(staff, "GET", "/returns?status=nope")).status).toBe(400);
});

it("stops two requests that together would pass the shipped count", async () => {
  const { me, order, line } = await threeBooks();
  const results = await Promise.all([
    requestReturn(me, order.id, [{ orderLineId: line, quantity: 2 }]),
    requestReturn(me, order.id, [{ orderLineId: line, quantity: 2 }]),
  ]);
  const statuses = results.map((r) => r.res.status).sort((a, b) => a - b);
  expect(statuses).not.toEqual([200, 200]);
  const kept = await db().select().from(returnsTable).where(eq(returnsTable.orderId, order.id));
  expect(kept.length).toBeLessThanOrEqual(1);
});
