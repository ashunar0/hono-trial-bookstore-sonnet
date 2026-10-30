import { z } from "zod";
import { VISIBLE_STATUSES } from "#/domains/order/rules";

const date = z.string();

export const returnResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.enum(["requested", "completed", "rejected"]),
  rejectReason: z.string().nullable(),
  requestedAt: date,
  completedAt: date.nullable(),
  lines: z.array(z.object({ orderLineId: z.string(), quantity: z.number() })),
});

export type ReturnResponse = z.infer<typeof returnResponseSchema>;

export const orderResponseSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  status: z.enum(VISIBLE_STATUSES),
  /** Sent back by the cancel */
  version: z.number(),
  subtotal: z.number(),
  discount: z.number(),
  shippingFee: z.number(),
  total: z.number(),
  tax: z.number(),
  couponCode: z.string().nullable(),
  paymentDueAt: date,
  paidAt: date.nullable(),
  shippedAt: date.nullable(),
  cancelledAt: date.nullable(),
  lines: z.array(
    z.object({
      id: z.string(),
      bookId: z.string(),
      title: z.string(),
      unitPrice: z.number(),
      quantity: z.number(),
      discount: z.number(),
    }),
  ),
  returns: z.array(returnResponseSchema),
  refunds: z.array(
    z.object({
      id: z.string(),
      returnId: z.string().nullable(),
      amount: z.number(),
      tax: z.number(),
    }),
  ),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;

type ReturnRow = {
  id: string;
  orderId: string;
  status: "requested" | "completed" | "rejected";
  rejectReason: string | null;
  requestedAt: Date;
  completedAt: Date | null;
};

/** A return as the API shows it. Orders and the returns list both show it, so it is made here */
export const returnResponse = (
  r: ReturnRow,
  lines: { returnId: string; orderLineId: string; quantity: number }[],
): ReturnResponse => ({
  id: r.id,
  orderId: r.orderId,
  status: r.status,
  rejectReason: r.rejectReason,
  requestedAt: r.requestedAt.toISOString(),
  completedAt: r.completedAt?.toISOString() ?? null,
  lines: lines
    .filter((l) => l.returnId === r.id)
    .map((l) => ({ orderLineId: l.orderLineId, quantity: l.quantity })),
});
