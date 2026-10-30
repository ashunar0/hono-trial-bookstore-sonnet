import { findBooks } from "#/domains/book/index";
import { listCartItems } from "#/domains/cart/index";
import { findCouponByCode } from "#/domains/coupon/index";
import type { NotApplicableReason } from "#/domains/coupon/rules";
import { quote } from "#/domains/pricing/rules";
import type { Db } from "#/db/index";
import type { CartResponse } from "./_response";

/** The cart with its books and an estimate; with a coupon code, the estimate as if it were used now */
export const readCart = async (
  db: Db,
  customerId: string,
  now: Date,
  couponCode?: string,
): Promise<{ ok: true; cart: CartResponse } | { ok: false; reason: NotApplicableReason }> => {
  const rows = await listCartItems(db, customerId);
  const books = new Map(
    (
      await findBooks(
        db,
        rows.map((r) => r.bookId),
      )
    ).map((b) => [b.id, b]),
  );
  const items = rows.flatMap((r) => {
    const book = books.get(r.bookId);
    return book === undefined
      ? []
      : [{ bookId: r.bookId, title: book.title, price: book.price, quantity: r.quantity }];
  });

  const coupon = couponCode === undefined ? undefined : await findCouponByCode(db, couponCode);
  if (couponCode !== undefined && coupon === undefined) return { ok: false, reason: "not_found" };

  const priced = quote(
    items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })),
    coupon ?? null,
    now,
  );
  if (!priced.ok) return priced;
  return {
    ok: true,
    cart: { items, couponCode: coupon?.code ?? null, estimate: priced.quote },
  };
};
