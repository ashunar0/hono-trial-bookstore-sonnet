import { err, NotFound, ok } from "hono-kit";
import { restockReturn } from "#/domains/inventory/index";
import type { Db } from "#/db/index";
import { changeReturn, insertRefund, markRestocked } from "../mutations";
import { countReturnedBooks, findOrderLines, findReturn, findReturnLines } from "../queries";
import { refundOfReturn, ReturnStatusConflict } from "../rules";

/**
 * The shop has received the returned books: the return is completed and the refund recorded in one batch,
 * then the books go back on the shelf (once per return id) and the time is noted.
 * The refund has a fixed id, so if two receives meet, the one whose version write lost adds no refund.
 * Cron calls it for a completed return not yet restocked (caller "cron"): it goes on from the shelf step
 */
export const receiveReturn = async (
  deps: { db: Db },
  caller: "staff" | "cron",
  returnId: string,
  now: Date,
) => {
  const { db } = deps;
  const ret = await findReturn(db, returnId);
  if (ret === undefined) return err(NotFound.code);

  const lines = await findOrderLines(db, [ret.orderId]);
  const returnLines = await findReturnLines(db, [returnId]);

  if (ret.status === "completed" && caller === "cron" && ret.restockedAt === null) {
    await putBack(deps, returnId, returnLines, lines, now);
    return ok(undefined);
  }
  if (ret.status !== "requested") {
    return err({ code: ReturnStatusConflict.code, details: { status: ret.status } });
  }

  const alreadyReturned = await countReturnedBooks(db, ret.orderId, ["completed"]);
  const refund = refundOfReturn(
    returnLines.flatMap((rl) => {
      const line = lines.find((l) => l.id === rl.orderLineId);
      return line === undefined
        ? []
        : [{ line, count: rl.quantity, alreadyReturned: alreadyReturned.get(line.id) ?? 0 }];
    }),
  );

  const [completed] = await db.batch([
    changeReturn(db, returnId, ret.version, { status: "completed", completedAt: now }),
    insertRefund(db, {
      id: `refund-${returnId}`,
      orderId: ret.orderId,
      returnId,
      amount: refund.amount,
      tax: refund.tax,
      createdAt: now,
    }),
  ]);
  if (completed.length === 0) {
    const current = await findReturn(db, returnId);
    return err({
      code: ReturnStatusConflict.code,
      details: { status: current?.status ?? ret.status },
    });
  }

  await putBack(deps, returnId, returnLines, lines, now);
  return ok(undefined);
};

/** Puts the returned books back on the shelf, then notes it. Twice is the same as once */
const putBack = async (
  deps: { db: Db },
  returnId: string,
  returnLines: { orderLineId: string; quantity: number }[],
  orderLines: { id: string; bookId: string }[],
  now: Date,
) => {
  const perBook = new Map<string, number>();
  for (const rl of returnLines) {
    const bookId = orderLines.find((l) => l.id === rl.orderLineId)?.bookId;
    if (bookId !== undefined) perBook.set(bookId, (perBook.get(bookId) ?? 0) + rl.quantity);
  }
  await restockReturn(
    deps,
    returnId,
    [...perBook].map(([bookId, quantity]) => ({ bookId, quantity })),
  );
  await markRestocked(deps.db, returnId, now);
};
