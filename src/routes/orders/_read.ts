import {
  findOrder,
  findOrderLines,
  findReturn,
  findRefunds,
  findReturnLines,
  findReturnsOfOrders,
} from "#/domains/order/index";
import type { Db } from "#/db/index";
import { returnResponse, type OrderResponse, type ReturnResponse } from "./_response";

type OrderRow = NonNullable<Awaited<ReturnType<typeof findOrder>>>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Orders as the API shows them: each with its lines, returns and refunds, read for all of them at once */
export const readOrders = async (db: Db, orders: OrderRow[]): Promise<OrderResponse[]> => {
  const ids = orders.map((o) => o.id);
  const [lines, returns, refunds] = await Promise.all([
    findOrderLines(db, ids),
    findReturnsOfOrders(db, ids),
    findRefunds(db, ids),
  ]);
  const returnLines = await findReturnLines(
    db,
    returns.map((r) => r.id),
  );

  return orders.flatMap((o) => {
    if (o.status === "placing") return [];
    return [
      {
        id: o.id,
        customerId: o.customerId,
        status: o.status,
        version: o.version,
        subtotal: o.subtotal,
        discount: o.discount,
        shippingFee: o.shippingFee,
        total: o.total,
        tax: o.tax,
        couponCode: o.couponCode,
        paymentDueAt: o.paymentDueAt.toISOString(),
        paidAt: iso(o.paidAt),
        shippedAt: iso(o.shippedAt),
        cancelledAt: iso(o.cancelledAt),
        lines: lines
          .filter((l) => l.orderId === o.id)
          .map((l) => ({
            id: l.id,
            bookId: l.bookId,
            title: l.title,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discount: l.discount,
          })),
        returns: returns
          .filter((r) => r.orderId === o.id)
          .map((r) => returnResponse(r, returnLines)),
        refunds: refunds
          .filter((r) => r.orderId === o.id)
          .map((r) => ({ id: r.id, returnId: r.returnId, amount: r.amount, tax: r.tax })),
      },
    ];
  });
};

/** One order as the API shows it, or undefined when there is none (or it is still placing) */
export const readOrder = async (db: Db, id: string): Promise<OrderResponse | undefined> => {
  const order = await findOrder(db, id);
  if (order === undefined) return undefined;
  const [shown] = await readOrders(db, [order]);
  return shown;
};

/** One return as the API shows it */
export const readReturnOf = async (db: Db, id: string): Promise<ReturnResponse | undefined> => {
  const ret = await findReturn(db, id);
  if (ret === undefined) return undefined;
  return returnResponse(ret, await findReturnLines(db, [id]));
};
