import { z } from "zod";

/** A line to hold or give back: this many of this book */
export type StockLine = { bookId: string; quantity: number };

/** Shortages, for the details of OUT_OF_STOCK: each book that cannot be had, and what is left */
export const outOfStockDetailsSchema = z.object({
  books: z.array(z.object({ bookId: z.string(), requested: z.number(), stock: z.number() })),
});

export const OutOfStock = {
  code: "OUT_OF_STOCK",
  kind: "conflict",
  message: "Not enough stock",
  details: outOfStockDetailsSchema,
} as const;

export const StockChanged = {
  code: "STOCK_CHANGED",
  kind: "conflict",
  message: "The stock changed while you were editing it",
} as const;

/** The body of PUT /books/[id]/stock: the stock to set, and the version read with it (0 when the book has no stocks row yet) */
export const stockInputSchema = z.object({
  stock: z.number().int().min(0),
  version: z.number().int().min(0),
});

export type StockInput = z.infer<typeof stockInputSchema>;

/** The shortages among these lines, given the stock now (a book not in `stocks` has 0) */
export const shortagesOf = (lines: StockLine[], stocks: Map<string, number>) =>
  lines
    .map((l) => ({ bookId: l.bookId, requested: l.quantity, stock: stocks.get(l.bookId) ?? 0 }))
    .filter((s) => s.stock < s.requested);
