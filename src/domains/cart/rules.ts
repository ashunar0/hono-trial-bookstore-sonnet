import { z } from "zod";

/** How many of a book to have in the cart */
export const cartItemInputSchema = z.object({ quantity: z.number().int().positive() });
