import { z } from "zod";

export const bookResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  price: z.number(),
  stock: z.number(),
  /** The version of the stock, sent back by PUT /books/[id]/stock (0 when the book has no stocks row yet) */
  stockVersion: z.number(),
});

export type BookResponse = z.infer<typeof bookResponseSchema>;
