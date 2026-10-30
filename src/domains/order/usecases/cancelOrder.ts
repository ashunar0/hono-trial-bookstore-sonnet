import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { changeOrder } from "../mutations";
import { findOrder } from "../queries";
import { canCancel, OrderStatusConflict, type Caller } from "../rules";
import { giveBack } from "./_giveBack";

/**
 * Cancels an order, for a customer, the shop, or cron (expired payment, stuck placing, a cancel that died halfway).
 * An operation that lets go switches first: the state moves to "cancelled" with the version the caller read
 * (a payment that got in first makes this a 409 and nothing happens), then the money, stock and coupon are given back.
 * Each give-back step does nothing the second time, so cron can call this again for a cancel that stopped halfway:
 * for it, a cancelled order not yet restored continues from the give-back
 */
export const cancelOrder = async (
  deps: { db: Db },
  caller: Caller,
  orderId: string,
  version: number,
  now: Date,
) => {
  const order = await findOrder(deps.db, orderId);
  if (order === undefined) return err(NotFound.code);
  if (order.status === "placing" && caller.kind !== "cron") return err(NotFound.code);
  if (caller.kind === "customer" && order.customerId !== caller.id) return err(NotFound.code);

  if (order.status === "cancelled" && caller.kind === "cron" && order.restoredAt === null) {
    await giveBack(deps, order, now);
    return ok(undefined);
  }
  if (!canCancel(order.status, caller)) {
    return err({ code: OrderStatusConflict.code, details: { status: order.status } });
  }

  const [cancelled] = await changeOrder(deps.db, orderId, version, {
    status: "cancelled",
    cancelledAt: now,
  });
  if (cancelled === undefined) {
    const current = await findOrder(deps.db, orderId);
    return err({
      code: OrderStatusConflict.code,
      details: { status: current?.status ?? order.status },
    });
  }
  await giveBack(deps, order, now);
  return ok(undefined);
};
