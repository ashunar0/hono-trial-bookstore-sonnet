import { expect, it } from "vitest";
import { alice, db, request, staff } from "../../../test/fixtures";
import { releaseCouponUse, useCoupon } from "#/domains/coupon/index";

const make = (over: Record<string, unknown> = {}) =>
  request(staff, "POST", "/coupons", {
    code: `C-${crypto.randomUUID()}`,
    type: "fixed",
    value: 500,
    minAmount: 3000,
    startsAt: "2026-11-01T00:00:00",
    endsAt: "2026-12-01T00:00:00",
    ...over,
  });

it("creates a coupon, lists it, and keeps codes unique", async () => {
  const res = await make({ code: "SPRING500" });
  expect(res.status).toBe(200);
  const coupon = (await res.json()) as { id: string; startsAt: string };
  expect(coupon.startsAt).toBe("2026-10-31T15:00:00.000Z");

  const list = await request(staff, "GET", "/coupons");
  const body = (await list.json()) as { items: { id: string }[] };
  expect(body.items.map((c) => c.id)).toContain(coupon.id);

  const again = await make({ code: "SPRING500" });
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ error: { code: "COUPON_CODE_TAKEN" } });
});

it("is for staff: 401 signed out, 403 for a customer, 400 for a bad coupon", async () => {
  expect((await request(null, "GET", "/coupons")).status).toBe(401);
  expect((await request(alice, "GET", "/coupons")).status).toBe(403);
  expect((await request(alice, "POST", "/coupons", {})).status).toBe(403);
  expect((await make({ minAmount: 100 })).status).toBe(400);
  expect((await make({ type: "percent", value: 120 })).status).toBe(400);
});

it("stops a coupon, twice without harm, and 404s a missing one", async () => {
  const coupon = (await (await make()).json()) as { id: string };
  const at = new Date("2026-11-05T00:00:00Z");
  const first = await request(staff, "POST", `/coupons/${coupon.id}/stop`, undefined, at);
  expect(await first.json()).toMatchObject({ stoppedAt: at.toISOString() });
  const second = await request(
    staff,
    "POST",
    `/coupons/${coupon.id}/stop`,
    undefined,
    new Date("2026-11-06T00:00:00Z"),
  );
  expect(await second.json()).toMatchObject({ stoppedAt: at.toISOString() });
  expect((await request(staff, "POST", "/coupons/nope/stop")).status).toBe(404);
  expect((await request(alice, "POST", `/coupons/${coupon.id}/stop`)).status).toBe(403);
});

it("lets a customer use a coupon once, until the use is given back", async () => {
  const coupon = (await (await make()).json()) as { id: string };
  const deps = { db: db() };
  const use = crypto.randomUUID();

  expect((await useCoupon(deps, use, coupon.id, "alice")).ok).toBe(true);
  expect((await useCoupon(deps, use, coupon.id, "alice")).ok).toBe(true); // same id: already done
  expect(await useCoupon(deps, crypto.randomUUID(), coupon.id, "alice")).toEqual({
    ok: false,
    error: "COUPON_ALREADY_USED",
  });
  expect((await useCoupon(deps, crypto.randomUUID(), coupon.id, "bob")).ok).toBe(true);

  await releaseCouponUse(deps, use);
  await releaseCouponUse(deps, use);
  expect((await useCoupon(deps, crypto.randomUUID(), coupon.id, "alice")).ok).toBe(true);
});
