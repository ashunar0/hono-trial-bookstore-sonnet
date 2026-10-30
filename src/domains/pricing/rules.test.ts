import { expect, it } from "vitest";
import type { CouponTerms } from "../coupon/rules";
import { quote, taxOf } from "./rules";

const coupon = (over: Partial<CouponTerms>): CouponTerms => ({
  type: "fixed",
  value: 500,
  minAmount: 3000,
  startsAt: new Date("2026-11-01T00:00:00+09:00"),
  endsAt: new Date("2026-12-01T00:00:00+09:00"),
  stoppedAt: null,
  ...over,
});
const now = new Date("2026-11-10T00:00:00Z");

it("matches the fixed-coupon example: 3500 - 500 = 3000, free shipping, tax 272", () => {
  const lines = [
    { unitPrice: 2000, quantity: 1 },
    { unitPrice: 1500, quantity: 1 },
  ];
  expect(quote(lines, coupon({}), now)).toEqual({
    ok: true,
    quote: { subtotal: 3500, discount: 500, shippingFee: 0, total: 3000, tax: 272 },
  });
});

it("matches the percent example: 1980 - 297 = 1683, shipping 550, total 2233, tax 203", () => {
  const lines = [{ unitPrice: 1980, quantity: 1 }];
  expect(quote(lines, coupon({ type: "percent", value: 15, minAmount: 0 }), now)).toEqual({
    ok: true,
    quote: { subtotal: 1980, discount: 297, shippingFee: 550, total: 2233, tax: 203 },
  });
});

it("decides free shipping after the coupon: 3000 is free, 2999 is not", () => {
  const free = quote([{ unitPrice: 3000, quantity: 1 }], null, now);
  expect(free).toMatchObject({ quote: { shippingFee: 0, total: 3000 } });
  const paid = quote([{ unitPrice: 2999, quantity: 1 }], null, now);
  expect(paid).toMatchObject({ quote: { shippingFee: 550, total: 3549 } });
  // 3300 books, 500 off: 2800 is under the line, so shipping is charged
  const dropped = quote([{ unitPrice: 3300, quantity: 1 }], coupon({ minAmount: 3000 }), now);
  expect(dropped).toMatchObject({ quote: { discount: 500, shippingFee: 550, total: 3350 } });
});

it("an empty cart costs nothing, shipping included", () => {
  expect(quote([], null, now)).toEqual({
    ok: true,
    quote: { subtotal: 0, discount: 0, shippingFee: 0, total: 0, tax: 0 },
  });
});

it("gives the reason when the coupon cannot be used", () => {
  const lines = [{ unitPrice: 2000, quantity: 1 }];
  expect(quote(lines, coupon({}), now)).toEqual({ ok: false, reason: "below_minimum" });
  expect(quote(lines, coupon({ stoppedAt: now, minAmount: 500 }), now)).toEqual({
    ok: false,
    reason: "stopped",
  });
});

it("finds the tax once from the total, rounding down", () => {
  expect(taxOf(3000)).toBe(272);
  expect(taxOf(2233)).toBe(203);
  expect(taxOf(109)).toBe(9);
});
