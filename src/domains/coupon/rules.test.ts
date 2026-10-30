import { expect, it } from "vitest";
import { couponInputSchema, discountOf, notApplicableReason, type CouponTerms } from "./rules";

const terms = (over: Partial<CouponTerms> = {}): CouponTerms => ({
  type: "fixed",
  value: 500,
  minAmount: 3000,
  startsAt: new Date("2026-11-01T00:00:00+09:00"),
  endsAt: new Date("2026-12-01T00:00:00+09:00"),
  stoppedAt: null,
  ...over,
});

it("takes the fixed amount, and rounds a percent down", () => {
  expect(discountOf({ type: "fixed", value: 500 }, 3500)).toBe(500);
  expect(discountOf({ type: "percent", value: 15 }, 1980)).toBe(297);
  expect(discountOf({ type: "percent", value: 15 }, 1999)).toBe(299);
  expect(discountOf({ type: "percent", value: 100 }, 1980)).toBe(1980);
});

it("judges the period in Japan time: start is in, end is out", () => {
  const c = terms();
  expect(notApplicableReason(c, 3000, new Date("2026-10-31T14:59:59.999Z"))).toBe("not_started");
  expect(notApplicableReason(c, 3000, new Date("2026-10-31T15:00:00.000Z"))).toBeNull();
  expect(notApplicableReason(c, 3000, new Date("2026-11-30T14:59:59.999Z"))).toBeNull();
  expect(notApplicableReason(c, 3000, new Date("2026-11-30T15:00:00.000Z"))).toBe("ended");
});

it("turns away a stopped coupon and a subtotal below the condition", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  expect(notApplicableReason(terms({ stoppedAt: now }), 3000, now)).toBe("stopped");
  expect(notApplicableReason(terms(), 2999, now)).toBe("below_minimum");
  expect(notApplicableReason(terms(), 3000, now)).toBeNull();
});

it("reads a date without an offset as Japan time", () => {
  const parsed = couponInputSchema.parse({
    code: "A",
    type: "percent",
    value: 10,
    startsAt: "2026-11-01T00:00:00",
    endsAt: "2026-11-02T00:00:00Z",
  });
  expect(parsed.startsAt.toISOString()).toBe("2026-10-31T15:00:00.000Z");
  expect(parsed.minAmount).toBe(0);
});

it("refuses a fixed coupon whose condition is below its discount, and a percent over 100", () => {
  const base = { code: "A", startsAt: "2026-11-01T00:00:00", endsAt: "2026-12-01T00:00:00" };
  expect(
    couponInputSchema.safeParse({ ...base, type: "fixed", value: 500, minAmount: 499 }).success,
  ).toBe(false);
  expect(
    couponInputSchema.safeParse({ ...base, type: "fixed", value: 500, minAmount: 500 }).success,
  ).toBe(true);
  expect(couponInputSchema.safeParse({ ...base, type: "percent", value: 101 }).success).toBe(false);
});
