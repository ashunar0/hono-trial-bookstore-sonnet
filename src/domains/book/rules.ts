import { z } from "zod";

/** What a book is registered or changed with (PUT sends all of it) */
export const bookInputSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  price: z.number().int().positive(),
});

export type BookInput = z.infer<typeof bookInputSchema>;
