CREATE TABLE `reservation_lines` (
	`reservation_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`reservation_id`, `book_id`),
	CONSTRAINT "reservation_lines_quantity_positive" CHECK("reservation_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	CONSTRAINT "reservations_status" CHECK("reservations"."status" in ('reserved', 'released'))
);
--> statement-breakpoint
CREATE TABLE `restocks` (
	`return_id` text NOT NULL,
	`book_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`return_id`, `book_id`),
	CONSTRAINT "restocks_quantity_positive" CHECK("restocks"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE `stocks` (
	`book_id` text PRIMARY KEY NOT NULL,
	`stock` integer NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT "stocks_stock_not_negative" CHECK("stocks"."stock" >= 0)
);
