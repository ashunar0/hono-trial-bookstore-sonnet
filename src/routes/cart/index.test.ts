import { expect, it } from "vitest";
import { alice, request, someone, staff } from "../../../test/fixtures";

const newBook = async (price: number) => {
  const res = await request(staff, "POST", "/books", { title: `b${price}`, author: "a", price });
  return ((await res.json()) as { id: string }).id;
};

const newCoupon = async (over: Record<string, unknown>) => {
  const code = `C-${crypto.randomUUID()}`;
  await request(staff, "POST", "/coupons", {
    code,
    type: "fixed",
    value: 500,
    minAmount: 3000,
    startsAt: "2026-11-01T00:00:00",
    endsAt: "2026-12-01T00:00:00",
    ...over,
  });
  return code;
};

const at = new Date("2026-11-10T00:00:00Z");

it("starts empty, adds a book, changes the count, takes it out", async () => {
  const me = someone();
  const book = await newBook(1500);

  const empty = await request(me, "GET", "/cart");
  expect(await empty.json()).toEqual({
    items: [],
    couponCode: null,
    estimate: { subtotal: 0, discount: 0, shippingFee: 0, total: 0, tax: 0 },
  });

  const one = await request(me, "PUT", `/cart/items/${book}`, { quantity: 1 });
  expect(await one.json()).toMatchObject({
    items: [{ bookId: book, price: 1500, quantity: 1 }],
    estimate: { subtotal: 1500, shippingFee: 550, total: 2050, tax: 186 },
  });
  const three = await request(me, "PUT", `/cart/items/${book}`, { quantity: 3 });
  expect(await three.json()).toMatchObject({
    items: [{ quantity: 3 }],
    estimate: { subtotal: 4500 },
  });

  const out = await request(me, "DELETE", `/cart/items/${book}`);
  expect(await out.json()).toEqual({ ok: true });
  expect(await request(me, "DELETE", `/cart/items/${book}`)).toHaveProperty("status", 200);
  expect(await (await request(me, "GET", "/cart")).json()).toMatchObject({ items: [] });
});

it("keeps each customer's cart apart", async () => {
  const me = someone();
  const book = await newBook(1000);
  await request(me, "PUT", `/cart/items/${book}`, { quantity: 1 });
  expect(await (await request(someone(), "GET", "/cart")).json()).toMatchObject({ items: [] });
});

it("rejects a zero or fractional count with 400, a missing book with 404, staff with 403, signed out with 401", async () => {
  const book = await newBook(1000);
  expect((await request(alice, "PUT", `/cart/items/${book}`, { quantity: 0 })).status).toBe(400);
  expect((await request(alice, "PUT", `/cart/items/${book}`, { quantity: 1.5 })).status).toBe(400);
  expect((await request(alice, "PUT", "/cart/items/nope", { quantity: 1 })).status).toBe(404);
  expect((await request(staff, "GET", "/cart")).status).toBe(403);
  expect((await request(null, "GET", "/cart")).status).toBe(401);
});

it("estimates with ?coupon= without using it, and says why a coupon does not fit", async () => {
  const me = someone();
  const a = await newBook(2000);
  const b = await newBook(1500);
  await request(me, "PUT", `/cart/items/${a}`, { quantity: 1 });
  await request(me, "PUT", `/cart/items/${b}`, { quantity: 1 });
  const code = await newCoupon({});

  const res = await request(me, "GET", `/cart?coupon=${code}`, undefined, at);
  expect(await res.json()).toMatchObject({
    couponCode: code,
    estimate: { subtotal: 3500, discount: 500, shippingFee: 0, total: 3000, tax: 272 },
  });
  // looking again still works: nothing was used
  expect((await request(me, "GET", `/cart?coupon=${code}`, undefined, at)).status).toBe(200);

  const early = await request(
    me,
    "GET",
    `/cart?coupon=${code}`,
    undefined,
    new Date("2026-10-01T00:00:00Z"),
  );
  expect(early.status).toBe(422);
  expect(await early.json()).toMatchObject({
    error: { code: "COUPON_NOT_APPLICABLE", details: { reason: "not_started" } },
  });
  const unknown = await request(me, "GET", "/cart?coupon=NOPE", undefined, at);
  expect(await unknown.json()).toMatchObject({ error: { details: { reason: "not_found" } } });

  await request(me, "DELETE", `/cart/items/${b}`);
  const small = await request(me, "GET", `/cart?coupon=${code}`, undefined, at);
  expect(await small.json()).toMatchObject({ error: { details: { reason: "below_minimum" } } });
});
