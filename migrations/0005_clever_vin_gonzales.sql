CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`discount` integer NOT NULL,
	CONSTRAINT "order_lines_quantity_positive" CHECK("order_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `order_lines_order` ON `order_lines` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`shipping_fee` integer NOT NULL,
	`total` integer NOT NULL,
	`tax` integer NOT NULL,
	`coupon_id` text,
	`coupon_code` text,
	`coupon_use_id` text,
	`reservation_id` text NOT NULL,
	`payment_due_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`shipped_at` integer,
	`cancelled_at` integer,
	`restored_at` integer,
	`version` integer NOT NULL,
	CONSTRAINT "orders_status" CHECK("orders"."status" in ('placing', 'awaiting_payment', 'paid', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `orders_customer` ON `orders` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`return_id` text,
	`amount` integer NOT NULL,
	`tax` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_return` ON `refunds` (`return_id`);--> statement-breakpoint
CREATE INDEX `refunds_order` ON `refunds` (`order_id`);--> statement-breakpoint
CREATE TABLE `return_lines` (
	`return_id` text NOT NULL,
	`order_line_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`return_id`, `order_line_id`),
	CONSTRAINT "return_lines_quantity_positive" CHECK("return_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`reject_reason` text,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	`rejected_at` integer,
	`restocked_at` integer,
	`version` integer NOT NULL,
	CONSTRAINT "returns_status" CHECK("returns"."status" in ('requested', 'completed', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `returns_order` ON `returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `returns_status` ON `returns` (`status`,`requested_at`);