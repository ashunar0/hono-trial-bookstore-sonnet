import { and, eq, lt, or, type AnyColumn, type SQL } from "drizzle-orm";
import type { PageQuery } from "hono-kit";

/** The rows after this position in a newest-first list ordered by (time, id); no condition on the first page */
export const olderThan = (
  at: AnyColumn,
  id: AnyColumn,
  after: PageQuery["after"],
): SQL | undefined =>
  after === undefined ? undefined : or(lt(at, after.at), and(eq(at, after.at), lt(id, after.id)));
