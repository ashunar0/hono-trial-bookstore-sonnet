import { findReturn, findReturnLines } from "#/domains/order/index";
import { returnResponse } from "../orders/_response";
import type { ReturnResponse } from "../orders/_response";
import type { Db } from "#/db/index";

type ReturnRow = NonNullable<Awaited<ReturnType<typeof findReturn>>>;

/** Returns as the API shows them, with their lines read for all at once */
export const readReturns = async (db: Db, rows: ReturnRow[]): Promise<ReturnResponse[]> => {
  const lines = await findReturnLines(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => returnResponse(r, lines));
};

export const readReturn = async (db: Db, id: string): Promise<ReturnResponse | undefined> => {
  const row = await findReturn(db, id);
  if (row === undefined) return undefined;
  const [shown] = await readReturns(db, [row]);
  return shown;
};
