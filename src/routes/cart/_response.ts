import { z } from "zod";

export const cartResponseSchema = z.object({
  items: z.array(
    z.object({
      bookId: z.string(),
      title: z.string(),
      price: z.number(),
      quantity: z.number(),
    }),
  ),
  /** The coupon the estimate was made with (?coupon=), or null */
  couponCode: z.string().nullable(),
  estimate: z.object({
    subtotal: z.number(),
    discount: z.number(),
    shippingFee: z.number(),
    total: z.number(),
    tax: z.number(),
  }),
});

export type CartResponse = z.infer<typeof cartResponseSchema>;
