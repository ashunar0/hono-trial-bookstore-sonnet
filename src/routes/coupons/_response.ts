import { z } from "zod";

export const couponResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(["fixed", "percent"]),
  value: z.number(),
  minAmount: z.number(),
  startsAt: z.string(),
  endsAt: z.string(),
  stoppedAt: z.string().nullable(),
});

export type CouponResponse = z.infer<typeof couponResponseSchema>;

type CouponRow = {
  id: string;
  code: string;
  type: "fixed" | "percent";
  value: number;
  minAmount: number;
  startsAt: Date;
  endsAt: Date;
  stoppedAt: Date | null;
};

export const couponResponse = (c: CouponRow): CouponResponse => ({
  id: c.id,
  code: c.code,
  type: c.type,
  value: c.value,
  minAmount: c.minAmount,
  startsAt: c.startsAt.toISOString(),
  endsAt: c.endsAt.toISOString(),
  stoppedAt: c.stoppedAt?.toISOString() ?? null,
});
