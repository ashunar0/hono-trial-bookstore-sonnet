import { createCron } from "hono-kit";
import {
  cancelOrder,
  findExpiredPayments,
  findStuckPlacing,
  findUnrestoredCancels,
} from "#/domains/order/index";
import { PLACING_STUCK_MS } from "#/domains/order/rules";

/** How many orders of each kind one run takes; the rest wait for the next run */
const BATCH = 100;

/**
 * Every 15 minutes: looks at the orders' states and calls cancelOrder. It writes nothing itself.
 * Each call can be made twice with the same result, so an order picked up again does no harm.
 * An order that fails is skipped and the others go on; the first failure is thrown at the end
 */
export const cron = createCron({ schedule: "*/15 * * * *" }, async ({ deps, now }) => {
  const { db } = deps;
  const caller = { kind: "cron" } as const;
  const failures: unknown[] = [];

  // what each pick-up reads: the id, and the version to cancel with (the one read now)
  const picked = [
    // awaiting payment past the due time
    ...(await findExpiredPayments(db, now, BATCH)),
    // stuck while placing for 10 minutes
    ...(await findStuckPlacing(db, new Date(now.getTime() - PLACING_STUCK_MS), BATCH)),
    // cancelled, but the give-back did not finish
    ...(await findUnrestoredCancels(db, BATCH)),
  ];

  for (const order of picked) {
    try {
      // a conflict (it was paid or cancelled meanwhile) means someone else was first: nothing to do
      await cancelOrder(deps, caller, order.id, order.version, now);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
});
