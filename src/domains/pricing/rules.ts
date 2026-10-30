import {
  discountOf,
  notApplicableReason,
  type CouponTerms,
  type NotApplicableReason,
} from "../coupon/rules";

/** Free shipping from this many yen (after the coupon), otherwise the fee */
export const FREE_SHIPPING_FROM = 3000;
export const SHIPPING_FEE = 550;

/** Tax is 10% of the tax-included total, found once at the end (10/110, rounded down) */
export const taxOf = (amount: number): number => Math.floor((amount * 10) / 110);

export type PricedLine = { unitPrice: number; quantity: number };

export type Quote = {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  tax: number;
};

export const subtotalOf = (lines: PricedLine[]): number =>
  lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

/** The shipping fee after the coupon. An empty cart has none */
export const shippingFeeOf = (afterDiscount: number, lineCount: number): number =>
  lineCount === 0 || afterDiscount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

/**
 * The estimate: subtotal, coupon off the books only, shipping from what is left, total, tax inside it.
 * A coupon that cannot be used (period, stopped, below its condition) gives the reason instead
 */
export const quote = (
  lines: PricedLine[],
  coupon: CouponTerms | null,
  now: Date,
): { ok: true; quote: Quote } | { ok: false; reason: NotApplicableReason } => {
  const subtotal = subtotalOf(lines);
  let discount = 0;
  if (coupon !== null) {
    const reason = notApplicableReason(coupon, subtotal, now);
    if (reason !== null) return { ok: false, reason };
    discount = discountOf(coupon, subtotal);
  }
  const afterDiscount = subtotal - discount;
  const shippingFee = shippingFeeOf(afterDiscount, lines.length);
  const total = afterDiscount + shippingFee;
  return { ok: true, quote: { subtotal, discount, shippingFee, total, tax: taxOf(total) } };
};
