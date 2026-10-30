import { createCron } from "hono-kit";
import { findUnrestockedReturns, receiveReturn } from "#/domains/order/index";

/** How many returns one run takes; the rest wait for the next run */
const BATCH = 100;

/**
 * Every 15 minutes: a completed return whose books are not back on the shelf yet (the receive stopped after
 * the refund) is finished by calling receiveReturn again, which goes on from the shelf step.
 * It writes nothing itself; the first failure is thrown after the others had their turn
 */
export const cron = createCron({ schedule: "*/15 * * * *" }, async ({ deps, now }) => {
  const failures: unknown[] = [];
  for (const ret of await findUnrestockedReturns(deps.db, BATCH)) {
    try {
      await receiveReturn(deps, "cron", ret.id, now);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
});
