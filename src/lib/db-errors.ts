/** Whether a write failed on a CHECK constraint (drizzle and D1 wrap the error, so it follows cause) */
export const isCheckViolation = (error: unknown): boolean => {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if (e.message.includes("CHECK constraint failed")) return true;
  }
  return false;
};
