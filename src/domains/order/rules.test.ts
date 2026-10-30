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
