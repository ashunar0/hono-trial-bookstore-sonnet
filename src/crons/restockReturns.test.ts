import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { returnsTable } from "#/db/schema";
import { makeDeps } from "#/main";
import { db, someone } from "../../test/fixtures";
import {
  addToCart,
  newBook,
  payAndShip,
  placeOrder,
  requestReturn,
  stockOf,
} from "../../test/setup";
import { cron } from "./restockReturns";

const run = (now: Date) => cron.run({ deps: makeDeps(env), now });

it("puts the books of a completed return back when the receive stopped after the refund", async () => {
  const me = someone();
  const book = await newBook(3000, 5);
  await addToCart(me, book, 2);
  const { order } = await placeOrder(me);
  const shipped = await payAndShip(me, order.id);
  const line = shipped.lines[0]?.id ?? "";
  const { ret } = await requestReturn(me, shipped.id, [{ orderLineId: line, quantity: 2 }]);

  // the state after the first step of receiveReturn and before the shelf step
  const completedAt = new Date("2026-11-12T01:00:00Z");
  await db()
    .update(returnsTable)
    .set({ status: "completed", completedAt, version: 2 })
    .where(eq(returnsTable.id, ret.id));
  expect(await stockOf(book)).toBe(3);

  const now = new Date("2026-11-12T01:15:00Z");
  await run(now);
  expect(await stockOf(book)).toBe(5);
  const [row] = await db().select().from(returnsTable).where(eq(returnsTable.id, ret.id));
  expect(row?.restockedAt).toEqual(now);

  await run(new Date("2026-11-12T01:30:00Z"));
  expect(await stockOf(book)).toBe(5);
});

it("leaves requested and rejected returns alone", async () => {
  const me = someone();
  const book = await newBook(3000, 5);
  await addToCart(me, book);
  const { order } = await placeOrder(me);
  const shipped = await payAndShip(me, order.id);
  await requestReturn(me, shipped.id, [{ orderLineId: shipped.lines[0]?.id ?? "", quantity: 1 }]);
  await run(new Date("2026-11-13T00:00:00Z"));
  expect(await stockOf(book)).toBe(4);
});
