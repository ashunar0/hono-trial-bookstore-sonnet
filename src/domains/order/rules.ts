import { z } from "zod";

export const ORDER_STATUSES = [
  "placing",
  "awaiting_payment",
  "paid",
  "shipped",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The states customers and staff can see: a placing order is not shown to anyone */
export const VISIBLE_STATUSES = ["awaiting_payment", "paid", "shipped", "cancelled"] as const;

const DAY = 24 * 60 * 60 * 1000;
/** Payment is due 3 days after the order is placed */
export const PAYMENT_DAYS = 3;
/** A return is accepted until 14 days after shipping */
export const RETURN_DAYS = 14;
/** An order still placing after this long is stuck: cron cancels it */
export const PLACING_STUCK_MS = 10 * 60 * 1000;

export const paymentDueAt = (placedAt: Date): Date =>
  new Date(placedAt.getTime() + PAYMENT_DAYS * DAY);

export const OrderStatusConflict = {
  code: "ORDER_STATUS_CONFLICT",
  kind: "conflict",
  message: "The order cannot do this in its current state",
  details: z.object({ status: z.enum(ORDER_STATUSES) }),
} as const;

export const CartEmpty = {
  code: "CART_EMPTY",
  kind: "unprocessable",
  message: "The cart is empty",
} as const;

export const PaymentDeadlinePassed = {
  code: "PAYMENT_DEADLINE_PASSED",
  kind: "unprocessable",
  message: "The payment deadline has passed",
} as const;

export const orderInputSchema = z.object({ couponCode: z.string().min(1).optional() });

/**
 * Splits the coupon's discount over the lines by the ratio of each line's amount (price x count).
 * Each line rounds down; the last line takes what is left so the parts add up to the discount exactly
 */
export const allocateDiscount = (
  lines: { unitPrice: number; quantity: number }[],
  discount: number,
): number[] => {
  const amounts = lines.map((l) => l.unitPrice * l.quantity);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  let given = 0;
  return amounts.map((amount, i) => {
    if (i === amounts.length - 1) return discount - given;
    const share = subtotal === 0 ? 0 : Math.floor((discount * amount) / subtotal);
    given += share;
    return share;
  });
};

/** Whether this user may see the order at all: a placing order is nobody's, a customer sees only their own */
export const canSeeOrder = (
  order: { customerId: string; status: OrderStatus },
  user: { id: string; role: "customer" | "staff" },
): boolean => order.status !== "placing" && (user.role === "staff" || order.customerId === user.id);
