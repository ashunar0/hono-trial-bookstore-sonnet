import { expect, it } from "vitest";
import { allocateDiscount, canSeeOrder } from "./rules";

it("allots the discount by each line's amount: A 285 and B 215 of 500", () => {
  const lines = [
    { unitPrice: 2000, quantity: 1 },
    { unitPrice: 1500, quantity: 1 },
  ];
  expect(allocateDiscount(lines, 500)).toEqual([285, 215]);
});

it("adds up to the discount exactly, the last line taking the rounding", () => {
  const lines = [
    { unitPrice: 333, quantity: 1 },
    { unitPrice: 333, quantity: 1 },
    { unitPrice: 334, quantity: 1 },
  ];
  const parts = allocateDiscount(lines, 100);
  expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  expect(parts).toEqual([33, 33, 34]);
});

it("allots nothing without a discount, and weighs a line by price times count", () => {
  expect(allocateDiscount([{ unitPrice: 1000, quantity: 3 }], 0)).toEqual([0]);
  expect(
    allocateDiscount(
      [
        { unitPrice: 1000, quantity: 3 },
        { unitPrice: 1000, quantity: 1 },
      ],
      400,
    ),
  ).toEqual([300, 100]);
});

it("hides a placing order from everyone and another's order from a customer", () => {
  const mine = { customerId: "u1", status: "paid" as const };
  expect(canSeeOrder(mine, { id: "u1", role: "customer" })).toBe(true);
  expect(canSeeOrder(mine, { id: "u2", role: "customer" })).toBe(false);
  expect(canSeeOrder(mine, { id: "s", role: "staff" })).toBe(true);
  expect(canSeeOrder({ ...mine, status: "placing" }, { id: "s", role: "staff" })).toBe(false);
});

import { refundOfLine, refundOfReturn, returnPeriodEnded, returnableOf } from "./rules";

const lineB = { id: "b", unitPrice: 1500, quantity: 1, discount: 215 };

it("gives back price minus the allotted discount: B 1500 - 215 = 1285, tax 116", () => {
  expect(refundOfLine(lineB, 1, 0)).toBe(1285);
  expect(refundOfReturn([{ line: lineB, count: 1, alreadyReturned: 0 }])).toEqual({
    amount: 1285,
    tax: 116,
  });
});

it("splits 500 off 3 x 1000 into 834, 834, 832: the last book takes the rest", () => {
  const line = { id: "x", unitPrice: 1000, quantity: 3, discount: 500 };
  expect(refundOfLine(line, 1, 0)).toBe(834);
  expect(refundOfLine(line, 1, 1)).toBe(834);
  expect(refundOfLine(line, 1, 2)).toBe(832);
  // all at once, or in two goes, the total is what was paid
  expect(refundOfLine(line, 3, 0)).toBe(2500);
  expect(refundOfLine(line, 2, 0) + refundOfLine(line, 1, 2)).toBe(2500);
});

it("does not look again at the coupon condition or shipping when books are returned", () => {
  // A (2000, -285) kept, B returned: only B's own price and discount count
  expect(refundOfReturn([{ line: lineB, count: 1, alreadyReturned: 0 }]).amount).toBe(1285);
});

it("counts requested and completed books against what can be returned", () => {
  const lines = [
    { id: "a", quantity: 2 },
    { id: "b", quantity: 1 },
  ];
  expect(returnableOf(lines, new Map([["a", 1]]))).toEqual([
    { orderLineId: "a", returnable: 1 },
    { orderLineId: "b", returnable: 1 },
  ]);
});

it("accepts a return until 14 days after shipping, to the millisecond", () => {
  const shipped = new Date("2026-11-01T00:00:00Z");
  expect(returnPeriodEnded(shipped, new Date("2026-11-15T00:00:00.000Z"))).toBe(false);
  expect(returnPeriodEnded(shipped, new Date("2026-11-15T00:00:00.001Z"))).toBe(true);
});
