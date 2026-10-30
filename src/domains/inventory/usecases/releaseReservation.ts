import type { Db } from "#/db/index";
import { giveBackHeldStock, markReleased } from "../mutations";

/**
 * Gives a hold back. The stock goes back only while the hold is reserved, then it is marked released:
 * in this order, since the other way round the first statement would already see released.
 * Run twice, or for an id that was never held, it changes nothing
 */
export const releaseReservation = async (deps: { db: Db }, reservationId: string) => {
  await deps.db.batch([
    giveBackHeldStock(deps.db, reservationId),
    markReleased(deps.db, reservationId),
  ]);
};
