import { z } from "zod";

export const bookResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  price: z.number(),
});

export type BookResponse = z.infer<typeof bookResponseSchema>;

export const bookResponse = (book: BookResponse): BookResponse => ({
  id: book.id,
  title: book.title,
  author: book.author,
  price: book.price,
});
