import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { changeOrder } from "../mutations";
import { findOrder } from "../queries";
import { OrderStatusConflict } from "../rules";

/** The shop ships a paid order */
export const shipOrder = async (deps: { db: Db }, orderId: string, now: Date) => {
  const order = await findOrder(deps.db, orderId);
  if (order === undefined || order.status === "placing") return err(NotFound.code);
  if (order.status !== "paid") {
    return err({ code: OrderStatusConflict.code, details: { status: order.status } });
  }
  const [shipped] = await changeOrder(deps.db, orderId, order.version, {
    status: "shipped",
    shippedAt: now,
  });
  if (shipped === undefined) {
    const current = await findOrder(deps.db, orderId);
    return err({
      code: OrderStatusConflict.code,
      details: { status: current?.status ?? order.status },
    });
  }
  return ok(undefined);
};
