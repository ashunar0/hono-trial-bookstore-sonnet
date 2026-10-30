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

export type Caller = { kind: "customer"; id: string } | { kind: "staff" } | { kind: "cron" };

/** Which states an order can be cancelled from, by who asks. Only cron sees (and cancels) a placing order */
export const canCancel = (status: OrderStatus, caller: Caller): boolean =>
  status === "awaiting_payment" ||
  status === "paid" ||
  (status === "placing" && caller.kind === "cron");

/** Whether the payment deadline has passed: paying at the very moment it is due still works */
export const paymentDeadlinePassed = (dueAt: Date, now: Date): boolean => now > dueAt;

// ── returns ───────────────────────────────────────────────────────────────

export const RETURN_STATUSES = ["requested", "completed", "rejected"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const ReturnPeriodEnded = {
  code: "RETURN_PERIOD_ENDED",
  kind: "unprocessable",
  message: "The return period has ended",
} as const;

export const ReturnQuantityExceeded = {
  code: "RETURN_QUANTITY_EXCEEDED",
  kind: "conflict",
  message: "More books than can still be returned",
  details: z.object({
    lines: z.array(z.object({ orderLineId: z.string(), returnable: z.number() })),
  }),
} as const;

export const ReturnStatusConflict = {
  code: "RETURN_STATUS_CONFLICT",
  kind: "conflict",
  message: "The return is not waiting to be received or rejected",
  details: z.object({ status: z.enum(RETURN_STATUSES) }),
} as const;

/** What the customer sends to return books: which lines, how many of each (a line once) */
export const returnInputSchema = z
  .object({
    lines: z
      .array(z.object({ orderLineId: z.string(), quantity: z.number().int().positive() }))
      .min(1),
  })
  .refine((v) => new Set(v.lines.map((l) => l.orderLineId)).size === v.lines.length, {
    message: "A line may appear once",
    path: ["lines"],
  });

export const rejectInputSchema = z.object({ reason: z.string().min(1) });

/** A return is accepted until 14 days after shipping; the very moment it ends is still in */
export const returnPeriodEnded = (shippedAt: Date, now: Date): boolean =>
  now.getTime() > shippedAt.getTime() + RETURN_DAYS * DAY;

type SoldLine = { id: string; unitPrice: number; quantity: number; discount: number };

/**
 * How many of each line can still be returned: what was shipped minus what is requested or completed
 * (rejected ones are not counted by the caller)
 */
export const returnableOf = (
  lines: { id: string; quantity: number }[],
  taken: Map<string, number>,
) => lines.map((l) => ({ orderLineId: l.id, returnable: l.quantity - (taken.get(l.id) ?? 0) }));

/**
 * What is paid back for returning `count` books of a line that already had `alreadyReturned` come back:
 * the price minus the discount allotted. The discount per book is rounded down, and the book that makes
 * the line complete carries what is left, so returning all of a line gives back exactly what was paid
 */
export const refundOfLine = (line: SoldLine, count: number, alreadyReturned: number): number => {
  const perBook = Math.floor(line.discount / line.quantity);
  const completes = alreadyReturned + count === line.quantity;
  const discount = perBook * count + (completes ? line.discount - perBook * line.quantity : 0);
  return line.unitPrice * count - discount;
};

/** The refund of a return: the sum over its lines, and the tax inside it (amount x 10/110, rounded down) */
export const refundOfReturn = (
  returned: { line: SoldLine; count: number; alreadyReturned: number }[],
): { amount: number; tax: number } => {
  const amount = returned.reduce(
    (sum, r) => sum + refundOfLine(r.line, r.count, r.alreadyReturned),
    0,
  );
  return { amount, tax: Math.floor((amount * 10) / 110) };
};
