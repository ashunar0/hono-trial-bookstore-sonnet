import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { changeOrder } from "../mutations";
import { findOrder } from "../queries";
import { OrderStatusConflict, PaymentDeadlinePassed, paymentDeadlinePassed } from "../rules";

/**
 * The customer pays (instead of a real payment). Only an order awaiting payment, and only before it is due:
 * cron may not have cancelled it yet, but a late payment is turned away all the same.
 * The write is conditional on the version just read, so a payment and a cancel at the same time: one wins, the other gets 409
 */
export const payOrder = async (
  deps: { db: Db },
  customerId: string,
  orderId: string,
  now: Date,
) => {
  const order = await findOrder(deps.db, orderId);
  if (order === undefined || order.status === "placing" || order.customerId !== customerId) {
    return err(NotFound.code);
  }
  if (order.status !== "awaiting_payment") {
    return err({ code: OrderStatusConflict.code, details: { status: order.status } });
  }
  if (paymentDeadlinePassed(order.paymentDueAt, now)) return err(PaymentDeadlinePassed.code);

  const [paid] = await changeOrder(deps.db, orderId, order.version, {
    status: "paid",
    paidAt: now,
  });
  if (paid === undefined) {
    const current = await findOrder(deps.db, orderId);
    return err({
      code: OrderStatusConflict.code,
      details: { status: current?.status ?? order.status },
    });
  }
  return ok(undefined);
};
