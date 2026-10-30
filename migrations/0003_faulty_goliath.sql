CREATE TABLE `coupon_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	CONSTRAINT "coupon_uses_status" CHECK("coupon_uses"."status" in ('used', 'released'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_uses_once_per_customer` ON `coupon_uses` (`coupon_id`,`customer_id`) WHERE "coupon_uses"."status" = 'used';--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`min_amount` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`stopped_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "coupons_type" CHECK("coupons"."type" in ('fixed', 'percent')),
	CONSTRAINT "coupons_value" CHECK(("coupons"."type" = 'fixed' and "coupons"."value" > 0 and "coupons"."min_amount" >= "coupons"."value") or ("coupons"."type" = 'percent' and "coupons"."value" between 1 and 100 and "coupons"."min_amount" >= 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code` ON `coupons` (`code`);