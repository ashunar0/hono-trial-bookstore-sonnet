import { expect, it } from "vitest";
import { alice, bob, request, someone, staff } from "../../../test/fixtures";
import { addToCart, newBook, newCoupon, NOW, placeOrder, stockOf } from "../../../test/setup";

it("places an order from the cart: amounts, allotted discounts, stock held, cart emptied", async () => {
  const me = someone();
  const a = await newBook(2000, 5);
  const b = await newBook(1500, 5);
  const coupon = await newCoupon();
  await addToCart(me, a);
  await addToCart(me, b);

  const { res, order } = await placeOrder(me, coupon.code);
  expect(res.status).toBe(200);
  expect(order).toMatchObject({
    status: "awaiting_payment",
    version: 2,
    subtotal: 3500,
    discount: 500,
    shippingFee: 0,
    total: 3000,
    tax: 272,
    couponCode: coupon.code,
    paymentDueAt: "2026-11-13T03:00:00.000Z",
    paidAt: null,
    returns: [],
    refunds: [],
  });
  expect(order.lines.map((l) => [l.bookId, l.discount])).toEqual(
    expect.arrayContaining([
      [a, 285],
      [b, 215],
    ]),
  );
  expect(await stockOf(a)).toBe(4);
  expect(await stockOf(b)).toBe(4);
  expect(await (await request(me, "GET", "/cart")).json()).toMatchObject({ items: [] });
});

it("orders without a coupon and pays the shipping under 3000", async () => {
  const me = someone();
  await addToCart(me, await newBook(1500, 5), 2);
  const { order } = await placeOrder(me);
  expect(order).toMatchObject({ subtotal: 3000, discount: 0, shippingFee: 0, couponCode: null });
  const small = someone();
  await addToCart(small, await newBook(1000, 5));
  expect((await placeOrder(small)).order).toMatchObject({
    shippingFee: 550,
    total: 1550,
    tax: 140,
  });
});

it("answers CART_EMPTY (422) for an empty cart", async () => {
  const { res } = await placeOrder(someone());
  expect(res.status).toBe(422);
  expect(await res.json()).toMatchObject({ error: { code: "CART_EMPTY" } });
});

it("answers COUPON_NOT_APPLICABLE (422) before touching stock", async () => {
  const me = someone();
  const book = await newBook(2000, 5);
  await addToCart(me, book);
  const coupon = await newCoupon();

  const low = await placeOrder(me, coupon.code);
  expect(low.res.status).toBe(422);
  expect(await low.res.json()).toMatchObject({
    error: { code: "COUPON_NOT_APPLICABLE", details: { reason: "below_minimum" } },
  });
  const unknown = await placeOrder(me, "NOPE");
  expect(await unknown.res.json()).toMatchObject({ error: { details: { reason: "not_found" } } });
  const early = await placeOrder(me, coupon.code, new Date("2026-10-01T00:00:00Z"));
  expect(await early.res.json()).toMatchObject({ error: { details: { reason: "not_started" } } });
  expect(await stockOf(book)).toBe(5);
});

it("answers OUT_OF_STOCK (409) with the short book, and leaves stock, coupon and cart as they were", async () => {
  const me = someone();
  const ok = await newBook(3000, 5);
  const short = await newBook(1000, 1);
  const coupon = await newCoupon();
  await addToCart(me, ok);
  await addToCart(me, short, 2);

  const { res } = await placeOrder(me, coupon.code);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({
    error: {
      code: "OUT_OF_STOCK",
      details: { books: [{ bookId: short, requested: 2, stock: 1 }] },
    },
  });
  expect(await stockOf(ok)).toBe(5);
  expect(await stockOf(short)).toBe(1);
  expect(await (await request(me, "GET", "/cart")).json()).toMatchObject({
    items: [{}, {}],
  });
  // nothing is left of the failed try: no order is listed
  const list = await request(me, "GET", "/orders");
  expect(await list.json()).toMatchObject({ items: [] });

  // the coupon was not used up by the failed try
  await request(me, "DELETE", `/cart/items/${short}`);
  await addToCart(me, ok);
  expect((await placeOrder(me, coupon.code)).res.status).toBe(200);
});

it("answers COUPON_ALREADY_USED (409) the second time, and gives the held stock back", async () => {
  const me = someone();
  const book = await newBook(3500, 5);
  const coupon = await newCoupon();
  await addToCart(me, book);
  expect((await placeOrder(me, coupon.code)).res.status).toBe(200);
  expect(await stockOf(book)).toBe(4);

  await addToCart(me, book);
  const { res } = await placeOrder(me, coupon.code);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: "COUPON_ALREADY_USED" } });
  expect(await stockOf(book)).toBe(4);
  // another customer can use it
  const other = someone();
  await addToCart(other, book);
  expect((await placeOrder(other, coupon.code)).res.status).toBe(200);
});

it("is for customers: 403 for staff, 401 signed out, 400 for an empty coupon code", async () => {
  expect((await request(staff, "POST", "/orders", {})).status).toBe(403);
  expect((await request(null, "POST", "/orders", {})).status).toBe(401);
  expect((await request(alice, "POST", "/orders", { couponCode: "" })).status).toBe(400);
});

it("shows an order to its owner and staff, and as 404 to another customer", async () => {
  const me = someone();
  await addToCart(me, await newBook(3000, 5));
  const { order } = await placeOrder(me);

  expect((await request(me, "GET", `/orders/${order.id}`)).status).toBe(200);
  expect((await request(staff, "GET", `/orders/${order.id}`)).status).toBe(200);
  expect((await request(bob, "GET", `/orders/${order.id}`)).status).toBe(404);
  expect((await request(me, "GET", "/orders/nope")).status).toBe(404);
  expect((await request(null, "GET", `/orders/${order.id}`)).status).toBe(401);
});

it("lists a customer's own orders newest first, filtered by status; staff see everyone's", async () => {
  const me = someone();
  const book = await newBook(3000, 20);
  await addToCart(me, book);
  const first = await placeOrder(me, undefined, new Date("2026-11-10T01:00:00Z"));
  await addToCart(me, book);
  const second = await placeOrder(me, undefined, new Date("2026-11-10T02:00:00Z"));

  const list = (await (await request(me, "GET", "/orders")).json()) as { items: { id: string }[] };
  expect(list.items.map((o) => o.id)).toEqual([second.order.id, first.order.id]);

  const paid = (await (await request(me, "GET", "/orders?status=paid")).json()) as {
    items: unknown[];
  };
  expect(paid.items).toEqual([]);
  expect((await request(me, "GET", "/orders?status=placing")).status).toBe(400);
  expect((await request(me, "GET", "/orders?status=awaiting_payment")).status).toBe(200);

  const all = (await (await request(staff, "GET", "/orders?limit=100")).json()) as {
    items: { id: string }[];
  };
  expect(all.items.map((o) => o.id)).toContain(first.order.id);
  // another customer sees none of mine
  expect(await (await request(someone(), "GET", "/orders")).json()).toMatchObject({ items: [] });
});

it("pages the list with a cursor", async () => {
  const me = someone();
  const book = await newBook(3000, 20);
  for (let i = 0; i < 3; i++) {
    await addToCart(me, book);
    await placeOrder(me, undefined, new Date(NOW.getTime() + i * 1000));
  }
  const page1 = (await (await request(me, "GET", "/orders?limit=2")).json()) as {
    items: unknown[];
    nextCursor: string;
  };
  expect(page1.items).toHaveLength(2);
  const page2 = (await (
    await request(me, "GET", `/orders?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`)
  ).json()) as { items: unknown[]; nextCursor: string | null };
  expect(page2.items).toHaveLength(1);
  expect(page2.nextCursor).toBeNull();
});
