import { z } from "zod";

export type CouponType = "fixed" | "percent";

/** What the rules need to know of a coupon */
export type CouponTerms = {
  type: CouponType;
  value: number;
  minAmount: number;
  startsAt: Date;
  endsAt: Date;
  stoppedAt: Date | null;
};

const JST_OFFSET = "+09:00";

/** A date and time with an offset or Z is itself; without one it is Japan time */
const dateTime = z.iso
  .datetime({ offset: true, local: true })
  .transform((s) => new Date(/(Z|[+-]\d\d:\d\d)$/.test(s) ? s : `${s}${JST_OFFSET}`));

export const couponInputSchema = z
  .object({
    code: z.string().min(1),
    type: z.enum(["fixed", "percent"]),
    /** Yen off for fixed, percent off for percent */
    value: z.number().int().positive(),
    /** The subtotal of the books must reach this. Defaults to 0 (percent only; fixed takes the discount at least) */
    minAmount: z.number().int().min(0).default(0),
    startsAt: dateTime,
    endsAt: dateTime,
  })
  .check((ctx) => {
    const { type, value, minAmount, startsAt, endsAt } = ctx.value;
    if (type === "percent" && value > 100)
      ctx.issues.push({
        code: "custom",
        message: "percent must be 1 to 100",
        input: value,
        path: ["value"],
      });
    if (type === "fixed" && minAmount < value)
      ctx.issues.push({
        code: "custom",
        message: "minAmount must be at least the discount",
        input: minAmount,
        path: ["minAmount"],
      });
    if (endsAt <= startsAt)
      ctx.issues.push({
        code: "custom",
        message: "endsAt must be after startsAt",
        input: endsAt,
        path: ["endsAt"],
      });
  });

export type CouponInput = z.infer<typeof couponInputSchema>;

export const notApplicableReasons = [
  "not_found",
  "stopped",
  "not_started",
  "ended",
  "below_minimum",
] as const;
export type NotApplicableReason = (typeof notApplicableReasons)[number];

export const CouponNotApplicable = {
  code: "COUPON_NOT_APPLICABLE",
  kind: "unprocessable",
  message: "This coupon cannot be used",
  details: z.object({ reason: z.enum(notApplicableReasons) }),
} as const;

export const CouponAlreadyUsed = {
  code: "COUPON_ALREADY_USED",
  kind: "conflict",
  message: "You have already used this coupon",
} as const;

export const CouponCodeTaken = {
  code: "COUPON_CODE_TAKEN",
  kind: "conflict",
  message: "This coupon code is taken",
} as const;

/** Why the coupon cannot be used for this subtotal at this moment, or null when it can */
export const notApplicableReason = (
  coupon: CouponTerms,
  subtotal: number,
  now: Date,
): NotApplicableReason | null => {
  if (coupon.stoppedAt !== null) return "stopped";
  if (now < coupon.startsAt) return "not_started";
  if (now >= coupon.endsAt) return "ended";
  if (subtotal < coupon.minAmount) return "below_minimum";
  return null;
};

/** The yen taken off the books' subtotal: fixed as it is, percent rounded down. Never more than the subtotal */
export const discountOf = (
  coupon: Pick<CouponTerms, "type" | "value">,
  subtotal: number,
): number => {
  const discount =
    coupon.type === "fixed" ? coupon.value : Math.floor((subtotal * coupon.value) / 100);
  return Math.min(discount, subtotal);
};
