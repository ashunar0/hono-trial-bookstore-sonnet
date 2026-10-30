import { err, NotFound, ok } from "hono-kit";
import type { Db } from "#/db/index";
import { changeReturn } from "../mutations";
import { findReturn } from "../queries";
import { ReturnStatusConflict } from "../rules";

/** The shop turns a return down and leaves the reason. Nothing is refunded and no stock moves */
export const rejectReturn = async (
  deps: { db: Db },
  returnId: string,
  reason: string,
  now: Date,
) => {
  const ret = await findReturn(deps.db, returnId);
  if (ret === undefined) return err(NotFound.code);
  if (ret.status !== "requested") {
    return err({ code: ReturnStatusConflict.code, details: { status: ret.status } });
  }
  const [rejected] = await changeReturn(deps.db, returnId, ret.version, {
    status: "rejected",
    rejectReason: reason,
    rejectedAt: now,
  });
  if (rejected === undefined) {
    const current = await findReturn(deps.db, returnId);
    return err({
      code: ReturnStatusConflict.code,
      details: { status: current?.status ?? ret.status },
    });
  }
  return ok(undefined);
};
