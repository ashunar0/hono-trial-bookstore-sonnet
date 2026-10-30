import type { SessionUser } from "hono-kit";
import { request, staff } from "./fixtures";

/** Helpers for tests that need books, stock, coupons and carts. All go through HTTP, like a client */

export const newBook = async (price: number, stock = 10) => {
  const res = await request(staff, "POST", "/books", {
    title: `book ${price}`,
    author: "a",
    price,
  });
  const book = (await res.json()) as { id: string };
  if (stock > 0) await request(staff, "PUT", `/books/${book.id}/stock`, { stock, version: 0 });
  return book.id;
};

export const stockOf = async (bookId: string) => {
  const res = await request(null, "GET", `/books/${bookId}`);
  return ((await res.json()) as { stock: number }).stock;
};

export const newCoupon = async (over: Record<string, unknown> = {}) => {
  const code = `C-${crypto.randomUUID()}`;
  const res = await request(staff, "POST", "/coupons", {
    code,
    type: "fixed",
    value: 500,
    minAmount: 3000,
    startsAt: "2026-11-01T00:00:00",
    endsAt: "2026-12-01T00:00:00",
    ...over,
  });
  return { code, id: ((await res.json()) as { id: string }).id };
};

export const addToCart = (user: SessionUser, bookId: string, quantity = 1) =>
  request(user, "PUT", `/cart/items/${bookId}`, { quantity });

/** A date inside the default coupon's period */
export const NOW = new Date("2026-11-10T03:00:00Z");

export type Order = {
  id: string;
  status: string;
  version: number;
  total: number;
  lines: { id: string; bookId: string; discount: number }[];
  [key: string]: unknown;
};

export const placeOrder = async (user: SessionUser, couponCode?: string, at = NOW) => {
  const res = await request(user, "POST", "/orders", { couponCode }, at);
  return { res, order: (await res.clone().json()) as Order };
};
