import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { deleteReturn, deleteReturnLines, insertReturn, insertReturnLines } from "../mutations";
import { countReturnedBooks, findOrder, findOrderLines } from "../queries";
import {
  OrderStatusConflict,
  ReturnPeriodEnded,
  ReturnQuantityExceeded,
  returnableOf,
  returnPeriodEnded,
} from "../rules";

type Wanted = { orderLineId: string; quantity: number }[];

/**
 * A customer asks to return books of a shipped order. Checks: the order is theirs (404), it is shipped (409),
 * within 14 days of shipping (422), and no line goes over what can still be returned (409).
 * Requested and completed books count; rejected ones do not.
 * Two requests at the same moment could both pass the count, so after writing the count is taken again,
 * and a request that went over takes itself back
 */
export const requestReturn = async (
  deps: { db: Db },
  customerId: string,
  orderId: string,
  wanted: Wanted,
  now: Date,
) => {
  const { db } = deps;
  const order = await findOrder(db, orderId);
  if (order === undefined || order.status === "placing" || order.customerId !== customerId) {
    return err(NotFound.code);
  }
  const lines = await findOrderLines(db, [orderId]);
  if (wanted.some((w) => !lines.some((l) => l.id === w.orderLineId))) return err(NotFound.code);

  if (order.status !== "shipped" || order.shippedAt === null) {
    return err({ code: OrderStatusConflict.code, details: { status: order.status } });
  }
  if (returnPeriodEnded(order.shippedAt, now)) return err(ReturnPeriodEnded.code);

  const exceeded = async (taken: Map<string, number>) => {
    const returnable = returnableOf(lines, taken);
    const over = wanted.some(
      (w) =>
        w.quantity > (returnable.find((r) => r.orderLineId === w.orderLineId)?.returnable ?? 0),
    );
    return over ? returnable : null;
  };

  const before = await exceeded(await countReturnedBooks(db, orderId, ["requested", "completed"]));
  if (before !== null)
    return err({ code: ReturnQuantityExceeded.code, details: { lines: before } });

  const id = crypto.randomUUID();
  await db.batch([
    insertReturn(db, { id, orderId, status: "requested", requestedAt: now, version: 1 }),
    insertReturnLines(
      db,
      wanted.map((w) => ({ returnId: id, orderLineId: w.orderLineId, quantity: w.quantity })),
    ),
  ]);

  // counting again with this request in: over the shipped count means another request got in at the same time
  const taken = await countReturnedBooks(db, orderId, ["requested", "completed"]);
  const stillOver = lines.some((l) => (taken.get(l.id) ?? 0) > l.quantity);
  if (stillOver) {
    await db.batch([deleteReturnLines(db, id), deleteReturn(db, id)]);
    const returnable = returnableOf(
      lines,
      await countReturnedBooks(db, orderId, ["requested", "completed"]),
    );
    return err({ code: ReturnQuantityExceeded.code, details: { lines: returnable } });
  }
  return ok(id);
};
